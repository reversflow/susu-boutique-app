create or replace function private.staff_safe_sale_receipt(p_receipt jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_set(
    p_receipt - 'costTotalCents' - 'profitCents',
    '{items}',
    coalesce(
      (
        select jsonb_agg(receipt_item.value - 'costTotalCents' order by receipt_item.position)
        from jsonb_array_elements(coalesce(p_receipt -> 'items', '[]'::jsonb))
          with ordinality as receipt_item(value, position)
      ),
      '[]'::jsonb
    ),
    true
  )
$$;
revoke all on function private.staff_safe_sale_receipt(jsonb) from public, anon, authenticated;

-- Keep the full receipt private for owner retries; expose only a caller-scoped public wrapper.
alter function public.complete_store_sale(jsonb, text) set schema private;
alter function private.complete_store_sale(jsonb, text) rename to complete_store_sale_impl;
revoke all on function private.complete_store_sale_impl(jsonb, text) from public, anon, authenticated;

create function public.complete_store_sale(p_items jsonb, p_request_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.current_business_id();
  v_receipt jsonb;
begin
  if v_business_id is null or not private.is_business_member(v_business_id) then
    raise exception using errcode = '42501', message = 'Business membership required.';
  end if;

  v_receipt := private.complete_store_sale_impl(p_items, p_request_id);
  if private.has_business_role(v_business_id, 'owner') then
    return v_receipt;
  end if;
  return private.staff_safe_sale_receipt(v_receipt);
end;
$$;
revoke all on function public.complete_store_sale(jsonb, text) from public, anon;
grant execute on function public.complete_store_sale(jsonb, text) to authenticated;

create or replace function public.get_store_today_summary(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.require_business_role('owner');
  v_summary jsonb;
begin
  if p_start is null or p_end is null or p_start >= p_end then
    raise exception using errcode = '22023', message = 'Summary date range is invalid.';
  end if;

  select jsonb_build_object(
    'totalCents', coalesce(sum(item.total_cents), 0),
    'unitsSold', coalesce(sum(item.units_sold), 0),
    'costTotalCents', case
      when count(item.id) <> count(item.cost_total_cents) then null
      else coalesce(sum(item.cost_total_cents), 0)
    end,
    'profitCents', case
      when count(item.id) <> count(item.cost_total_cents) then null
      else coalesce(sum(item.total_cents), 0) - coalesce(sum(item.cost_total_cents), 0)
    end
  )
  into v_summary
  from public.store_sales as sale
  join public.store_sale_items as item
    on item.business_id = sale.business_id and item.sale_id = sale.id
  where sale.business_id = v_business_id
    and sale.sold_at >= p_start
    and sale.sold_at < p_end;

  return v_summary;
end;
$$;
revoke all on function public.get_store_today_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_store_today_summary(timestamptz, timestamptz) to authenticated;

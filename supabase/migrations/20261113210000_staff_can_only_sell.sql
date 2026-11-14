create or replace function private.has_business_role(
  target_business_id uuid,
  required_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members as member
    where member.business_id = target_business_id
      and member.user_id = (select auth.uid())
      and member.role = required_role
  );
$$;

create or replace function private.require_business_role(required_role text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.current_business_id();
begin
  if v_business_id is null or not private.has_business_role(v_business_id, required_role) then
    raise exception using errcode = '42501', message = 'Insufficient business role.';
  end if;
  return v_business_id;
end;
$$;

revoke all on function private.has_business_role(uuid, text) from public, anon;
grant execute on function private.has_business_role(uuid, text) to authenticated;
revoke all on function private.require_business_role(text) from public, anon, authenticated;

-- Move privileged implementations out of the exposed API schema. Public RPC wrappers below
-- perform the role check before invoking these SECURITY DEFINER functions.
alter function public.create_store_category(text) set schema private;
alter function private.create_store_category(text) rename to create_store_category_impl;
alter function public.create_store_price_group(bigint, bigint, text) set schema private;
alter function private.create_store_price_group(bigint, bigint, text) rename to create_store_price_group_impl;
alter function public.add_store_stock(bigint, bigint, integer, bigint, text) set schema private;
alter function private.add_store_stock(bigint, bigint, integer, bigint, text) rename to add_store_stock_impl;
alter function public.receive_store_stock(bigint, integer, bigint, text, bigint) set schema private;
alter function private.receive_store_stock(bigint, integer, bigint, text, bigint) rename to receive_store_stock_impl;
alter function public.set_store_price_group_photo(bigint, text) set schema private;
alter function private.set_store_price_group_photo(bigint, text) rename to set_store_price_group_photo_impl;

revoke all on function private.create_store_category_impl(text) from public, anon, authenticated;
revoke all on function private.create_store_price_group_impl(bigint, bigint, text) from public, anon, authenticated;
revoke all on function private.add_store_stock_impl(bigint, bigint, integer, bigint, text) from public, anon, authenticated;
revoke all on function private.receive_store_stock_impl(bigint, integer, bigint, text, bigint) from public, anon, authenticated;
revoke all on function private.set_store_price_group_photo_impl(bigint, text) from public, anon, authenticated;

create function public.create_store_category(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_business_role('owner');
  return private.create_store_category_impl(p_name);
end;
$$;

create function public.create_store_price_group(
  p_category_id bigint,
  p_price_cents bigint,
  p_photo_path text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_business_role('owner');
  return private.create_store_price_group_impl(p_category_id, p_price_cents, p_photo_path);
end;
$$;

create function public.add_store_stock(
  p_category_id bigint,
  p_price_cents bigint,
  p_units integer,
  p_unit_cost_cents bigint default null,
  p_photo_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_business_role('owner');
  return private.add_store_stock_impl(
    p_category_id, p_price_cents, p_units, p_unit_cost_cents, p_photo_path
  );
end;
$$;

create function public.receive_store_stock(
  p_price_group_id bigint,
  p_units integer,
  p_supplier_id bigint default null,
  p_note text default '',
  p_unit_cost_cents bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_business_role('owner');
  return private.receive_store_stock_impl(
    p_price_group_id, p_units, p_supplier_id, p_note, p_unit_cost_cents
  );
end;
$$;

create function public.set_store_price_group_photo(p_price_group_id bigint, p_photo_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_business_role('owner');
  return private.set_store_price_group_photo_impl(p_price_group_id, p_photo_path);
end;
$$;

revoke all on function public.create_store_category(text) from public, anon;
revoke all on function public.create_store_price_group(bigint, bigint, text) from public, anon;
revoke all on function public.add_store_stock(bigint, bigint, integer, bigint, text) from public, anon;
revoke all on function public.receive_store_stock(bigint, integer, bigint, text, bigint) from public, anon;
revoke all on function public.set_store_price_group_photo(bigint, text) from public, anon;
grant execute on function public.create_store_category(text) to authenticated;
grant execute on function public.create_store_price_group(bigint, bigint, text) to authenticated;
grant execute on function public.add_store_stock(bigint, bigint, integer, bigint, text) to authenticated;
grant execute on function public.receive_store_stock(bigint, integer, bigint, text, bigint) to authenticated;
grant execute on function public.set_store_price_group_photo(bigint, text) to authenticated;

drop policy if exists "Members can access suppliers" on public.suppliers;
create policy "Owners can manage suppliers"
  on public.suppliers for all to authenticated
  using (private.has_business_role(business_id, 'owner'))
  with check (private.has_business_role(business_id, 'owner'));

drop policy if exists "Members can read store sales" on public.store_sales;
create policy "Owners can read store sales"
  on public.store_sales for select to authenticated
  using (private.has_business_role(business_id, 'owner'));

drop policy if exists "Members can read store sale items" on public.store_sale_items;
create policy "Owners can read store sale items"
  on public.store_sale_items for select to authenticated
  using (private.has_business_role(business_id, 'owner'));

drop policy if exists "Members can read store stock lots" on public.store_stock_lots;
create policy "Owners can read store stock lots"
  on public.store_stock_lots for select to authenticated
  using (private.has_business_role(business_id, 'owner'));

drop policy if exists "Members can read stock movements" on public.store_stock_movements;
create policy "Owners can read stock movements"
  on public.store_stock_movements for select to authenticated
  using (private.has_business_role(business_id, 'owner'));

drop policy if exists "Business members can upload product images" on storage.objects;
create policy "Owners can upload product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'store-product-images'
    and private.has_business_role((storage.foldername(name))[1]::uuid, 'owner')
  );

drop policy if exists "Business members can update product images" on storage.objects;
create policy "Owners can update product images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'store-product-images'
    and private.has_business_role((storage.foldername(name))[1]::uuid, 'owner')
  )
  with check (
    bucket_id = 'store-product-images'
    and private.has_business_role((storage.foldername(name))[1]::uuid, 'owner')
  );

drop policy if exists "Business members can delete product images" on storage.objects;
create policy "Owners can delete product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'store-product-images'
    and private.has_business_role((storage.foldername(name))[1]::uuid, 'owner')
  );

create or replace function public.get_store_dashboard_summary(p_category_id bigint default null)
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
  select jsonb_build_object(
    'unitsSold', coalesce(sum(item.units_sold), 0),
    'revenueCents', coalesce(sum(item.total_cents), 0),
    'soldCostCents', case
      when count(item.id) <> count(item.cost_total_cents) then null
      else coalesce(sum(item.cost_total_cents), 0)
    end
  )
  into v_summary
  from public.store_sale_items as item
  join public.store_price_groups as price_group
    on price_group.business_id = item.business_id
    and price_group.id = item.price_group_id
  where item.business_id = v_business_id
    and (p_category_id is null or price_group.category_id = p_category_id);

  return v_summary;
end;
$$;

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
  v_business_id uuid := private.current_business_id();
  v_summary jsonb;
begin
  if v_business_id is null or not private.is_business_member(v_business_id) then
    raise exception using errcode = '42501', message = 'Business membership required.';
  end if;
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

revoke all on function public.get_store_dashboard_summary(bigint) from public, anon;
grant execute on function public.get_store_dashboard_summary(bigint) to authenticated;
revoke all on function public.get_store_today_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_store_today_summary(timestamptz, timestamptz) to authenticated;

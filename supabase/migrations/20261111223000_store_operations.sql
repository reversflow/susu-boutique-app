create or replace function public.create_store_category(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.current_business_id();
  v_name text := btrim(p_name);
  v_sort_order integer;
  v_category public.store_categories;
begin
  if v_business_id is null then
    raise exception using errcode = '42501', message = 'Business membership required.';
  end if;
  if v_name is null or v_name = '' or char_length(v_name) > 40 then
    raise exception using errcode = '22023', message = 'Category name is invalid.';
  end if;

  perform 1 from public.businesses where id = v_business_id for update;
  if exists (
    select 1 from public.store_categories
    where business_id = v_business_id and lower(name) = lower(v_name)
  ) then
    raise exception using errcode = '23505', message = 'Category already exists.';
  end if;
  select coalesce(max(sort_order), -1) + 1 into v_sort_order
  from public.store_categories where business_id = v_business_id;

  insert into public.store_categories (business_id, name, sort_order)
  values (v_business_id, v_name, v_sort_order)
  returning * into v_category;

  return jsonb_build_object('id', v_category.id, 'name', v_category.name, 'sortOrder', v_category.sort_order);
end;
$$;

create or replace function public.create_store_price_group(
  p_category_id bigint,
  p_price_cents bigint,
  p_photo_path text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.current_business_id();
  v_sort_order integer;
  v_group public.store_price_groups;
begin
  if v_business_id is null then
    raise exception using errcode = '42501', message = 'Business membership required.';
  end if;
  if p_price_cents is null or p_price_cents <= 0 then
    raise exception using errcode = '22023', message = 'Price must be greater than zero.';
  end if;
  if p_price_cents > 9007199254740991 then
    raise exception using errcode = '22003', message = 'Price exceeds the supported limit.';
  end if;
  if p_photo_path is not null and p_photo_path <> '' and split_part(p_photo_path, '/', 1) <> v_business_id::text then
    raise exception using errcode = '42501', message = 'Photo path is outside this business.';
  end if;

  perform 1 from public.store_categories
  where business_id = v_business_id and id = p_category_id and is_active
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Category is unavailable.';
  end if;
  if exists (
    select 1 from public.store_price_groups
    where business_id = v_business_id and category_id = p_category_id and price_cents = p_price_cents
  ) then
    raise exception using errcode = '23505', message = 'Price group already exists.';
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_sort_order
  from public.store_price_groups
  where business_id = v_business_id and category_id = p_category_id;
  insert into public.store_price_groups (
    business_id, category_id, price_cents, sort_order, photo_path
  ) values (
    v_business_id, p_category_id, p_price_cents, v_sort_order, coalesce(p_photo_path, '')
  ) returning * into v_group;

  return jsonb_build_object(
    'id', v_group.id, 'categoryId', v_group.category_id, 'priceCents', v_group.price_cents,
    'stockUnits', v_group.stock_units, 'sortOrder', v_group.sort_order, 'photoPath', v_group.photo_path
  );
end;
$$;

create or replace function public.add_store_stock(
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
declare
  v_business_id uuid := private.current_business_id();
  v_group public.store_price_groups;
  v_sort_order integer;
  v_purchase_total bigint;
  v_purchase_total_exact numeric;
begin
  if v_business_id is null then
    raise exception using errcode = '42501', message = 'Business membership required.';
  end if;
  if p_units is null or p_units <= 0 or p_price_cents is null or p_price_cents <= 0 then
    raise exception using errcode = '22023', message = 'Units and price must be greater than zero.';
  end if;
  if p_price_cents > 9007199254740991 then
    raise exception using errcode = '22003', message = 'Price exceeds the supported limit.';
  end if;
  if p_unit_cost_cents is not null and p_unit_cost_cents < 0 then
    raise exception using errcode = '22023', message = 'Unit cost cannot be negative.';
  end if;
  if p_unit_cost_cents > 9007199254740991 then
    raise exception using errcode = '22003', message = 'Unit cost exceeds the supported limit.';
  end if;
  if p_photo_path is not null and p_photo_path <> '' and split_part(p_photo_path, '/', 1) <> v_business_id::text then
    raise exception using errcode = '42501', message = 'Photo path is outside this business.';
  end if;

  v_purchase_total_exact := case
    when p_unit_cost_cents is null then null
    else p_unit_cost_cents::numeric * p_units::numeric
  end;
  if v_purchase_total_exact > 9007199254740991 then
    raise exception using errcode = '22003', message = 'Purchase total exceeds the supported limit.';
  end if;
  v_purchase_total := v_purchase_total_exact::bigint;

  perform 1 from public.store_categories
  where business_id = v_business_id and id = p_category_id and is_active
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Category is unavailable.';
  end if;

  select * into v_group
  from public.store_price_groups
  where business_id = v_business_id and category_id = p_category_id and price_cents = p_price_cents and is_active
  for update;

  if found then
    if v_group.stock_units::bigint + p_units > 2147483647 then
      raise exception using errcode = '22003', message = 'Stock exceeds the supported limit.';
    end if;
    update public.store_price_groups
    set stock_units = stock_units + p_units,
        photo_path = coalesce(nullif(p_photo_path, ''), photo_path)
    where business_id = v_business_id and id = v_group.id
    returning * into v_group;
  else
    select coalesce(max(sort_order), -1) + 1 into v_sort_order
    from public.store_price_groups
    where business_id = v_business_id and category_id = p_category_id;
    insert into public.store_price_groups (
      business_id, category_id, price_cents, stock_units, sort_order, photo_path
    ) values (
      v_business_id, p_category_id, p_price_cents, p_units, v_sort_order, coalesce(p_photo_path, '')
    ) returning * into v_group;
  end if;

  insert into public.store_stock_lots (
    business_id, price_group_id, received_units, remaining_units, unit_cost_cents
  ) values (
    v_business_id, v_group.id, p_units, p_units, p_unit_cost_cents
  );
  insert into public.store_stock_movements (
    business_id, price_group_id, movement_type, units_delta, cost_total_cents
  ) values (
    v_business_id, v_group.id, 'entrada', p_units, v_purchase_total
  );

  return jsonb_build_object(
    'id', v_group.id, 'categoryId', v_group.category_id, 'priceCents', v_group.price_cents,
    'stockUnits', v_group.stock_units, 'sortOrder', v_group.sort_order, 'photoPath', v_group.photo_path
  );
end;
$$;

create or replace function public.receive_store_stock(
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
declare
  v_business_id uuid := private.current_business_id();
  v_group public.store_price_groups;
  v_purchase_total bigint;
  v_purchase_total_exact numeric;
begin
  if v_business_id is null then
    raise exception using errcode = '42501', message = 'Business membership required.';
  end if;
  if p_units is null or p_units <= 0 then
    raise exception using errcode = '22023', message = 'Units must be greater than zero.';
  end if;
  if p_unit_cost_cents is not null and p_unit_cost_cents < 0 then
    raise exception using errcode = '22023', message = 'Unit cost cannot be negative.';
  end if;
  if p_unit_cost_cents > 9007199254740991 then
    raise exception using errcode = '22003', message = 'Unit cost exceeds the supported limit.';
  end if;
  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers where business_id = v_business_id and id = p_supplier_id
  ) then
    raise exception using errcode = 'P0001', message = 'Supplier is unavailable.';
  end if;

  select * into v_group
  from public.store_price_groups
  where business_id = v_business_id and id = p_price_group_id and is_active
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Price group is unavailable.';
  end if;
  if v_group.stock_units::bigint + p_units > 2147483647 then
    raise exception using errcode = '22003', message = 'Stock exceeds the supported limit.';
  end if;

  v_purchase_total_exact := case
    when p_unit_cost_cents is null then null
    else p_unit_cost_cents::numeric * p_units::numeric
  end;
  if v_purchase_total_exact > 9007199254740991 then
    raise exception using errcode = '22003', message = 'Purchase total exceeds the supported limit.';
  end if;
  v_purchase_total := v_purchase_total_exact::bigint;

  update public.store_price_groups
  set stock_units = stock_units + p_units
  where business_id = v_business_id and id = p_price_group_id
  returning * into v_group;

  insert into public.store_stock_lots (
    business_id, price_group_id, received_units, remaining_units, unit_cost_cents
  ) values (
    v_business_id, p_price_group_id, p_units, p_units, p_unit_cost_cents
  );
  insert into public.store_stock_movements (
    business_id, price_group_id, movement_type, units_delta, supplier_id, note, cost_total_cents
  ) values (
    v_business_id, p_price_group_id, 'entrada', p_units, p_supplier_id, btrim(coalesce(p_note, '')), v_purchase_total
  );

  return jsonb_build_object(
    'id', v_group.id, 'categoryId', v_group.category_id, 'priceCents', v_group.price_cents,
    'stockUnits', v_group.stock_units, 'sortOrder', v_group.sort_order, 'photoPath', v_group.photo_path
  );
end;
$$;

create or replace function public.set_store_price_group_photo(p_price_group_id bigint, p_photo_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.current_business_id();
  v_group public.store_price_groups;
begin
  if v_business_id is null then
    raise exception using errcode = '42501', message = 'Business membership required.';
  end if;
  if p_photo_path is not null and p_photo_path <> '' and split_part(p_photo_path, '/', 1) <> v_business_id::text then
    raise exception using errcode = '42501', message = 'Photo path is outside this business.';
  end if;

  update public.store_price_groups
  set photo_path = coalesce(p_photo_path, '')
  where business_id = v_business_id and id = p_price_group_id
  returning * into v_group;
  if not found then
    raise exception using errcode = 'P0001', message = 'Price group is unavailable.';
  end if;

  return jsonb_build_object('id', v_group.id, 'photoPath', v_group.photo_path);
end;
$$;

create or replace function public.complete_store_sale(p_items jsonb, p_request_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.current_business_id();
  v_item jsonb;
  v_group record;
  v_lot record;
  v_existing public.store_sales;
  v_group_id bigint;
  v_units integer;
  v_requested_units integer;
  v_input_groups integer;
  v_locked_groups integer := 0;
  v_needed integer;
  v_taken integer;
  v_base_price bigint;
  v_group_stock integer;
  v_unit_price bigint;
  v_line_total bigint;
  v_line_total_exact numeric;
  v_line_cost bigint;
  v_line_cost_exact numeric;
  v_line_cost_known boolean;
  v_cost_known boolean := true;
  v_total_cents bigint := 0;
  v_cost_total_cents bigint := 0;
  v_units_sold bigint := 0;
  v_receipt_items jsonb := '[]'::jsonb;
  v_receipt jsonb;
  v_sale_id bigint;
  v_first_item jsonb;
  v_movement record;
begin
  if v_business_id is null then
    raise exception using errcode = '42501', message = 'Business membership required.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = '22023', message = 'Sale must contain between 1 and 100 items.';
  end if;
  if p_request_id is not null and p_request_id !~ '^[A-Za-z0-9_-]{8,100}$' then
    raise exception using errcode = '22023', message = 'Request id is invalid.';
  end if;

  if p_request_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_business_id::text || ':' || p_request_id, 0)
    );
    select * into v_existing
    from public.store_sales
    where business_id = v_business_id and request_id = p_request_id;
    if found then
      if v_existing.request_payload is distinct from p_items then
        raise exception using errcode = 'P0001', message = 'Request id was already used for a different sale.';
      end if;
      return v_existing.request_receipt;
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) as items(value) loop
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item -> 'priceGroupId') <> 'number'
       or jsonb_typeof(v_item -> 'units') <> 'number' then
      raise exception using errcode = '22023', message = 'Sale item is invalid.';
    end if;
    if (v_item ->> 'priceGroupId') !~ '^[1-9][0-9]*$'
       or (v_item ->> 'units') !~ '^[1-9][0-9]*$' then
      raise exception using errcode = '22023', message = 'Sale item ids and units must be positive integers.';
    end if;
    if v_item ? 'unitPriceCents' and jsonb_typeof(v_item -> 'unitPriceCents') <> 'null' then
      if jsonb_typeof(v_item -> 'unitPriceCents') <> 'number'
         or (v_item ->> 'unitPriceCents') !~ '^[1-9][0-9]*$' then
        raise exception using errcode = '22023', message = 'Unit price must be a positive integer.';
      end if;
      if (v_item ->> 'unitPriceCents')::numeric > 9007199254740991 then
        raise exception using errcode = '22003', message = 'Unit price exceeds the supported limit.';
      end if;
    end if;
    if (v_item ->> 'units')::numeric > 2147483647 then
      raise exception using errcode = '22003', message = 'Units exceed the supported limit.';
    end if;
  end loop;

  select count(distinct (items.value ->> 'priceGroupId')::bigint)
  into v_input_groups
  from jsonb_array_elements(p_items) as items(value);

  for v_group in
    select price_group.id, price_group.price_cents, price_group.stock_units
    from public.store_price_groups as price_group
    join public.store_categories as category
      on category.business_id = price_group.business_id
      and category.id = price_group.category_id
    where price_group.business_id = v_business_id
      and price_group.is_active
      and category.is_active
      and price_group.id in (
        select distinct (items.value ->> 'priceGroupId')::bigint
        from jsonb_array_elements(p_items) as items(value)
      )
    order by price_group.id
    for update of price_group
  loop
    v_locked_groups := v_locked_groups + 1;
    select sum((items.value ->> 'units')::integer)::integer
    into v_requested_units
    from jsonb_array_elements(p_items) as items(value)
    where (items.value ->> 'priceGroupId')::bigint = v_group.id;
    if v_group.stock_units < v_requested_units then
      raise exception using errcode = 'P0001', message = format('Only %s units remain.', v_group.stock_units);
    end if;
  end loop;
  if v_locked_groups <> v_input_groups then
    raise exception using errcode = 'P0001', message = 'A price group is unavailable.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) as items(value) loop
    v_group_id := (v_item ->> 'priceGroupId')::bigint;
    v_units := (v_item ->> 'units')::integer;
    select price_group.price_cents, price_group.stock_units
    into v_base_price, v_group_stock
    from public.store_price_groups as price_group
    where price_group.business_id = v_business_id and price_group.id = v_group_id;

    v_unit_price := coalesce(nullif(v_item ->> 'unitPriceCents', 'null')::bigint, v_base_price);
    v_line_total_exact := v_unit_price::numeric * v_units::numeric;
    if v_line_total_exact <= 0 or v_line_total_exact > 9007199254740991 then
      raise exception using errcode = '22003', message = 'Sale total exceeds the supported limit.';
    end if;
    v_line_total := v_line_total_exact::bigint;

    select sum((items.value ->> 'units')::integer)::integer
    into v_requested_units
    from jsonb_array_elements(p_items) as items(value)
    where (items.value ->> 'priceGroupId')::bigint = v_group_id;
    v_needed := v_units;
    v_line_cost := 0;
    v_line_cost_exact := 0;
    v_line_cost_known := true;

    for v_lot in
      select lot.id, lot.remaining_units, lot.unit_cost_cents
      from public.store_stock_lots as lot
      where lot.business_id = v_business_id
        and lot.price_group_id = v_group_id
        and lot.remaining_units > 0
      order by lot.id
      for update
    loop
      exit when v_needed = 0;
      v_taken := least(v_lot.remaining_units, v_needed);
      if v_lot.unit_cost_cents is null then
        v_line_cost_known := false;
      else
        v_line_cost_exact := v_line_cost_exact + v_lot.unit_cost_cents::numeric * v_taken::numeric;
        if v_line_cost_exact > 9007199254740991 then
          raise exception using errcode = '22003', message = 'Sale cost exceeds the supported limit.';
        end if;
      end if;
      update public.store_stock_lots
      set remaining_units = remaining_units - v_taken
      where business_id = v_business_id and id = v_lot.id;
      v_needed := v_needed - v_taken;
    end loop;
    if v_needed <> 0 then
      raise exception using errcode = 'P0001', message = 'Stock lots do not match the available stock.';
    end if;
    if not v_line_cost_known then
      v_line_cost := null;
      v_cost_known := false;
    else
      v_line_cost := v_line_cost_exact::bigint;
      v_cost_total_cents := v_cost_total_cents + v_line_cost;
      if v_cost_total_cents > 9007199254740991 then
        raise exception using errcode = '22003', message = 'Sale cost exceeds the supported limit.';
      end if;
    end if;

    v_total_cents := v_total_cents + v_line_total;
    v_units_sold := v_units_sold + v_units;
    if v_total_cents > 9007199254740991 then
      raise exception using errcode = '22003', message = 'Sale total exceeds the supported limit.';
    end if;

    v_receipt_items := v_receipt_items || jsonb_build_array(jsonb_build_object(
      'priceGroupId', v_group_id,
      'units', v_units,
      'baseUnitPriceCents', v_base_price,
      'unitPriceCents', v_unit_price,
      'totalCents', v_line_total,
      'costTotalCents', v_line_cost,
      'remainingUnits', v_group_stock - v_requested_units
    ));
  end loop;

  insert into public.store_sales (
    business_id, sold_at, total_cents, request_id, request_payload
  ) values (
    v_business_id, now(), v_total_cents, p_request_id, case when p_request_id is null then null else p_items end
  ) returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(v_receipt_items) as items(value) loop
    insert into public.store_sale_items (
      business_id, sale_id, price_group_id, units_sold, base_unit_price_cents,
      unit_price_cents, total_cents, cost_total_cents
    ) values (
      v_business_id,
      v_sale_id,
      (v_item ->> 'priceGroupId')::bigint,
      (v_item ->> 'units')::integer,
      (v_item ->> 'baseUnitPriceCents')::bigint,
      (v_item ->> 'unitPriceCents')::bigint,
      (v_item ->> 'totalCents')::bigint,
      nullif(v_item ->> 'costTotalCents', 'null')::bigint
    );
  end loop;

  for v_group_id in
    select distinct (items.value ->> 'priceGroupId')::bigint
    from jsonb_array_elements(v_receipt_items) as items(value)
    order by 1
  loop
    select sum((items.value ->> 'units')::integer)::integer as units,
           sum((items.value ->> 'totalCents')::bigint)::bigint as charged_total,
           case when count(*) = count(nullif(items.value ->> 'costTotalCents', 'null'))
             then sum((items.value ->> 'costTotalCents')::bigint)::bigint else null end as cost_total
    into v_movement
    from jsonb_array_elements(v_receipt_items) as items(value)
    where (items.value ->> 'priceGroupId')::bigint = v_group_id;

    update public.store_price_groups
    set stock_units = stock_units - v_movement.units
    where business_id = v_business_id and id = v_group_id;

    insert into public.store_stock_movements (
      business_id, price_group_id, movement_type, units_delta, sale_id,
      cost_total_cents, charged_total_cents
    ) values (
      v_business_id, v_group_id, 'venta', -v_movement.units, v_sale_id,
      v_movement.cost_total, v_movement.charged_total
    );
  end loop;

  v_first_item := v_receipt_items -> 0;
  v_receipt := jsonb_build_object(
    'saleId', v_sale_id,
    'unitsSold', v_units_sold,
    'unitPriceCents', (v_first_item ->> 'unitPriceCents')::bigint,
    'totalCents', v_total_cents,
    'remainingUnits', (v_first_item ->> 'remainingUnits')::integer,
    'items', v_receipt_items,
    'costTotalCents', case when v_cost_known then to_jsonb(v_cost_total_cents) else 'null'::jsonb end,
    'profitCents', case when v_cost_known then to_jsonb(v_total_cents - v_cost_total_cents) else 'null'::jsonb end
  );
  update public.store_sales
  set request_receipt = v_receipt
  where business_id = v_business_id and id = v_sale_id;

  return v_receipt;
end;
$$;

create or replace function public.get_store_dashboard_summary(p_category_id bigint default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'unitsSold', coalesce(sum(item.units_sold), 0),
    'revenueCents', coalesce(sum(item.total_cents), 0),
    'soldCostCents', case
      when count(item.id) <> count(item.cost_total_cents) then null
      else coalesce(sum(item.cost_total_cents), 0)
    end
  )
  from public.store_sale_items as item
  join public.store_price_groups as price_group
    on price_group.business_id = item.business_id
    and price_group.id = item.price_group_id
  where p_category_id is null or price_group.category_id = p_category_id;
$$;

revoke all on function public.create_store_category(text) from public, anon;
revoke all on function public.create_store_price_group(bigint, bigint, text) from public, anon;
revoke all on function public.add_store_stock(bigint, bigint, integer, bigint, text) from public, anon;
revoke all on function public.receive_store_stock(bigint, integer, bigint, text, bigint) from public, anon;
revoke all on function public.set_store_price_group_photo(bigint, text) from public, anon;
revoke all on function public.complete_store_sale(jsonb, text) from public, anon;
revoke all on function public.get_store_dashboard_summary(bigint) from public, anon;

grant execute on function public.create_store_category(text) to authenticated;
grant execute on function public.create_store_price_group(bigint, bigint, text) to authenticated;
grant execute on function public.add_store_stock(bigint, bigint, integer, bigint, text) to authenticated;
grant execute on function public.receive_store_stock(bigint, integer, bigint, text, bigint) to authenticated;
grant execute on function public.set_store_price_group_photo(bigint, text) to authenticated;
grant execute on function public.complete_store_sale(jsonb, text) to authenticated;
grant execute on function public.get_store_dashboard_summary(bigint) to authenticated;

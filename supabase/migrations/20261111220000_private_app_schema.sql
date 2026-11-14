create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id),
  unique (user_id)
);

create or replace function private.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.business_id
  from public.business_members as member
  where member.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function private.is_business_member(target_business_id uuid)
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
  );
$$;

revoke all on function private.current_business_id() from public, anon;
revoke all on function private.is_business_member(uuid) from public, anon;
grant execute on function private.current_business_id() to authenticated;
grant execute on function private.is_business_member(uuid) to authenticated;

create table public.store_categories (
  id bigint generated always as identity primary key,
  business_id uuid not null default private.current_business_id()
    references public.businesses(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);

create unique index store_categories_business_lower_name_idx
  on public.store_categories (business_id, lower(name));

create table public.suppliers (
  id bigint generated always as identity primary key,
  business_id uuid not null default private.current_business_id()
    references public.businesses(id) on delete cascade,
  name text not null,
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (business_id, id)
);

create index suppliers_business_name_idx
  on public.suppliers (business_id, lower(name));

create table public.store_price_groups (
  id bigint generated always as identity primary key,
  business_id uuid not null default private.current_business_id()
    references public.businesses(id) on delete cascade,
  category_id bigint not null,
  price_cents bigint not null check (price_cents > 0),
  stock_units integer not null default 0 check (stock_units >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  photo_path text not null default '',
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, category_id, price_cents),
  foreign key (business_id, category_id)
    references public.store_categories (business_id, id) on delete restrict
);

create index store_price_groups_business_category_idx
  on public.store_price_groups (business_id, category_id, is_active, sort_order, price_cents);

create table public.store_sales (
  id bigint generated always as identity primary key,
  business_id uuid not null default private.current_business_id()
    references public.businesses(id) on delete cascade,
  sold_at timestamptz not null default now(),
  total_cents bigint not null check (total_cents >= 0),
  request_id text,
  request_payload jsonb,
  request_receipt jsonb,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, request_id),
  check (request_id is null or char_length(request_id) between 8 and 100)
);

create index store_sales_business_sold_at_idx
  on public.store_sales (business_id, sold_at desc, id desc);

create table public.store_sale_items (
  id bigint generated always as identity primary key,
  business_id uuid not null default private.current_business_id()
    references public.businesses(id) on delete cascade,
  sale_id bigint not null,
  price_group_id bigint not null,
  units_sold integer not null check (units_sold > 0),
  base_unit_price_cents bigint not null check (base_unit_price_cents > 0),
  unit_price_cents bigint not null check (unit_price_cents > 0),
  total_cents bigint not null check (total_cents > 0),
  cost_total_cents bigint check (cost_total_cents is null or cost_total_cents >= 0),
  created_at timestamptz not null default now(),
  foreign key (business_id, sale_id)
    references public.store_sales (business_id, id) on delete cascade,
  foreign key (business_id, price_group_id)
    references public.store_price_groups (business_id, id) on delete restrict
);

create index store_sale_items_business_sale_idx
  on public.store_sale_items (business_id, sale_id, id);

create table public.store_stock_lots (
  id bigint generated always as identity primary key,
  business_id uuid not null default private.current_business_id()
    references public.businesses(id) on delete cascade,
  price_group_id bigint not null,
  received_units integer not null check (received_units > 0),
  remaining_units integer not null check (remaining_units >= 0 and remaining_units <= received_units),
  unit_cost_cents bigint check (unit_cost_cents is null or unit_cost_cents >= 0),
  created_at timestamptz not null default now(),
  foreign key (business_id, price_group_id)
    references public.store_price_groups (business_id, id) on delete restrict
);

create index store_stock_lots_business_fifo_idx
  on public.store_stock_lots (business_id, price_group_id, id);

create table public.store_stock_movements (
  id bigint generated always as identity primary key,
  business_id uuid not null default private.current_business_id()
    references public.businesses(id) on delete cascade,
  price_group_id bigint not null,
  movement_type text not null check (movement_type in ('venta', 'entrada', 'ajuste')),
  units_delta integer not null check (units_delta <> 0),
  supplier_id bigint,
  sale_id bigint,
  note text not null default '',
  cost_total_cents bigint check (cost_total_cents is null or cost_total_cents >= 0),
  charged_total_cents bigint check (charged_total_cents is null or charged_total_cents >= 0),
  created_at timestamptz not null default now(),
  foreign key (business_id, price_group_id)
    references public.store_price_groups (business_id, id) on delete restrict,
  foreign key (business_id, supplier_id)
    references public.suppliers (business_id, id) on delete set null (supplier_id),
  foreign key (business_id, sale_id)
    references public.store_sales (business_id, id) on delete set null (sale_id)
);

create index store_stock_movements_business_created_at_idx
  on public.store_stock_movements (business_id, created_at desc, id desc);

create index store_stock_movements_business_price_group_idx
  on public.store_stock_movements (business_id, price_group_id, created_at desc, id desc);

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.store_categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.store_price_groups enable row level security;
alter table public.store_sales enable row level security;
alter table public.store_sale_items enable row level security;
alter table public.store_stock_lots enable row level security;
alter table public.store_stock_movements enable row level security;

create policy "Members can read their business"
  on public.businesses for select to authenticated
  using (private.is_business_member(id));

create policy "Users can read their own membership"
  on public.business_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Members can read store categories"
  on public.store_categories for select to authenticated
  using (private.is_business_member(business_id));

create policy "Members can access suppliers"
  on public.suppliers for all to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));

create policy "Members can read store price groups"
  on public.store_price_groups for select to authenticated
  using (private.is_business_member(business_id));

create policy "Members can read store sales"
  on public.store_sales for select to authenticated
  using (private.is_business_member(business_id));

create policy "Members can read store sale items"
  on public.store_sale_items for select to authenticated
  using (private.is_business_member(business_id));

create policy "Members can read store stock lots"
  on public.store_stock_lots for select to authenticated
  using (private.is_business_member(business_id));

create policy "Members can read stock movements"
  on public.store_stock_movements for select to authenticated
  using (private.is_business_member(business_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-product-images',
  'store-product-images',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Business members can read product images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'store-product-images'
    and private.is_business_member((storage.foldername(name))[1]::uuid)
  );

create policy "Business members can upload product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'store-product-images'
    and private.is_business_member((storage.foldername(name))[1]::uuid)
  );

create policy "Business members can update product images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'store-product-images'
    and private.is_business_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'store-product-images'
    and private.is_business_member((storage.foldername(name))[1]::uuid)
  );

create policy "Business members can delete product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'store-product-images'
    and private.is_business_member((storage.foldername(name))[1]::uuid)
  );

grant select on public.businesses, public.business_members,
  public.store_categories, public.store_price_groups, public.store_sales,
  public.store_sale_items, public.store_stock_lots, public.store_stock_movements
  to authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into public.businesses (slug, name)
values ('susu-boutique', 'Susu’s Boutique')
on conflict (slug) do nothing;

insert into public.store_categories (business_id, name, sort_order)
select business.id, category.name, category.sort_order
from public.businesses as business
cross join (values
  ('Anillos', 0),
  ('Collares', 1),
  ('Pulseras', 2),
  ('Pendientes', 3)
) as category(name, sort_order)
where business.slug = 'susu-boutique'
on conflict do nothing;

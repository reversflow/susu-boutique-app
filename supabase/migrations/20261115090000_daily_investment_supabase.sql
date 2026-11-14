create table public.daily_records (
  business_id uuid not null default private.current_business_id()
    references public.businesses(id) on delete cascade,
  date date not null,
  total_sold numeric not null,
  additional_expenses numeric not null default 0,
  profit_percent numeric not null,
  notes text not null default '',
  dataphone_sales numeric not null default 0,
  created_at timestamptz not null default now(),
  primary key (business_id, date)
);

create index daily_records_business_date_desc_idx
  on public.daily_records (business_id, date desc);

create table public.investment_adjustments (
  id bigint generated always as identity primary key,
  business_id uuid not null default private.current_business_id()
    references public.businesses(id) on delete cascade,
  date date not null,
  amount numeric not null,
  note text not null default '',
  type text not null default 'ajuste' check (type in ('ajuste', 'compra')),
  supplier_id bigint,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, supplier_id)
    references public.suppliers (business_id, id) on delete set null (supplier_id)
);

create index investment_adjustments_business_date_id_idx
  on public.investment_adjustments (business_id, date desc, id desc);

alter table public.daily_records enable row level security;
alter table public.investment_adjustments enable row level security;

create policy "Owners can manage daily records"
  on public.daily_records for all to authenticated
  using (private.has_business_role(business_id, 'owner'))
  with check (private.has_business_role(business_id, 'owner'));

create policy "Owners can manage investment adjustments"
  on public.investment_adjustments for all to authenticated
  using (private.has_business_role(business_id, 'owner'))
  with check (private.has_business_role(business_id, 'owner'));

grant select, insert, update, delete on public.daily_records, public.investment_adjustments
  to authenticated;
grant usage, select on sequence public.investment_adjustments_id_seq to authenticated;

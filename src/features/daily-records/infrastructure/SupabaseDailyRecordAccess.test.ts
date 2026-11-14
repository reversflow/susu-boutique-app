import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const ownerId = '11111111-1111-4111-8111-111111111111';
const staffId = '22222222-2222-4222-8222-222222222222';
const businessId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondOwnerId = '33333333-3333-4333-8333-333333333333';
const secondBusinessId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const migrations = [
  '20261111220000_private_app_schema.sql',
  '20261111223000_store_operations.sql',
  '20261113210000_staff_can_only_sell.sql',
  '20261114120000_staff_sale_financial_boundary.sql',
  '20261115090000_daily_investment_supabase.sql',
];

async function asUser<T>(db: PGlite, userId: string, action: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('set role authenticated');
  try {
    return await action();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

async function createHarness(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid
    language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (bucket_id text not null, name text not null);
    create function storage.foldername(text) returns text[]
    language sql immutable
    as $$ select string_to_array($1, '/') $$;
  `);

  for (const migration of migrations) {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations', migration), 'utf8');
    await db.exec(sql);
  }
  await db.query('insert into auth.users (id) values ($1::uuid), ($2::uuid)', [ownerId, staffId]);
  await db.query(
    'insert into public.businesses (id, slug, name) values ($1::uuid, $2, $3)',
    [businessId, 'daily-test', 'Daily test business'],
  );
  await db.query(
    'insert into public.business_members (business_id, user_id, role) values ($1::uuid, $2::uuid, $3), ($1::uuid, $4::uuid, $5)',
    [businessId, ownerId, 'owner', staffId, 'staff'],
  );
  return db;
}

describe('Supabase daily record access', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createHarness();
  });

  afterEach(async () => {
    await db.close();
  });

  it('allows owners to create, read, update, and delete daily records without changing date or numeric semantics', async () => {
    await asUser(db, ownerId, async () => {
      await db.query(
        `insert into public.daily_records (date, total_sold, additional_expenses, profit_percent, notes, dataphone_sales)
         values ($1::date, $2::numeric, $3::numeric, $4::numeric, $5, $6::numeric)`,
        ['2026-11-15', 1234.56, 12.34, 0.275, 'owner note', 98.76],
      );
      const { rows } = await db.query(
        'select date::text, total_sold::text, additional_expenses::text, profit_percent::text, notes, dataphone_sales::text from public.daily_records',
      );
      expect(rows).toEqual([{
        date: '2026-11-15',
        total_sold: '1234.56',
        additional_expenses: '12.34',
        profit_percent: '0.275',
        notes: 'owner note',
        dataphone_sales: '98.76',
      }]);
      const updated = await db.query(
        'update public.daily_records set notes = $1 where date = $2::date returning notes',
        ['updated', '2026-11-15'],
      );
      expect(updated.rows).toEqual([{ notes: 'updated' }]);
      const deleted = await db.query('delete from public.daily_records where date = $1::date returning date', ['2026-11-15']);
      expect(deleted.rows).toHaveLength(1);
    });

    const { rows } = await db.query('select count(*)::integer as count from public.daily_records');
    expect((rows[0] as { count: number }).count).toBe(0);
  });

  it('denies staff access to daily record data and mutations', async () => {
    await asUser(db, ownerId, () => db.query(
      `insert into public.daily_records (date, total_sold, additional_expenses, profit_percent, notes, dataphone_sales)
       values ('2026-11-14', 100, 0, 0.2, 'owner row', 0)`,
    ));
    await asUser(db, staffId, async () => {
      const { rows } = await db.query('select * from public.daily_records');
      expect(rows).toEqual([]);
      const updated = await db.query("update public.daily_records set notes = 'staff edit' returning date");
      expect(updated.rows).toEqual([]);
      const deleted = await db.query('delete from public.daily_records returning date');
      expect(deleted.rows).toEqual([]);
      await expect(db.query(
        `insert into public.daily_records (date, total_sold, additional_expenses, profit_percent, notes, dataphone_sales)
         values ('2026-11-15', 100, 0, 0.2, '', 0)`,
      )).rejects.toMatchObject({ code: '42501' });
    });
    await asUser(db, ownerId, async () => {
      const { rows } = await db.query('select date::text, notes from public.daily_records');
      expect(rows).toEqual([{ date: '2026-11-14', notes: 'owner row' }]);
    });
  });

  it('upserts one daily record per business and date', async () => {
    await asUser(db, ownerId, async () => {
      await db.query(
        `insert into public.daily_records (date, total_sold, additional_expenses, profit_percent, notes, dataphone_sales)
         values ('2026-11-15', 100.00, 0, 0.2, 'first', 0)
         on conflict (business_id, date) do update set notes = excluded.notes`,
      );
      await db.query(
        `insert into public.daily_records (date, total_sold, additional_expenses, profit_percent, notes, dataphone_sales)
         values ('2026-11-15', 250.00, 5, 0.25, 'updated', 10)
         on conflict (business_id, date) do update set
           total_sold = excluded.total_sold,
           additional_expenses = excluded.additional_expenses,
           profit_percent = excluded.profit_percent,
           notes = excluded.notes,
           dataphone_sales = excluded.dataphone_sales`,
      );
      const { rows } = await db.query(
        'select count(*)::integer as count, max(total_sold)::text as total_sold, max(notes) as notes from public.daily_records',
      );
      expect(rows).toEqual([{ count: 1, total_sold: '250.00', notes: 'updated' }]);
    });
  });

  it('isolates daily records by business', async () => {
    await db.query('insert into auth.users (id) values ($1::uuid)', [secondOwnerId]);
    await db.query(
      'insert into public.businesses (id, slug, name) values ($1::uuid, $2, $3)',
      [secondBusinessId, 'daily-test-two', 'Daily test business 2'],
    );
    await db.query(
      'insert into public.business_members (business_id, user_id, role) values ($1::uuid, $2::uuid, $3)',
      [secondBusinessId, secondOwnerId, 'owner'],
    );

    await asUser(db, ownerId, () => db.query(
      `insert into public.daily_records (date, total_sold, additional_expenses, profit_percent, notes, dataphone_sales)
       values ('2026-11-15', 100, 0, 0.2, 'first business', 0)`,
    ));
    await asUser(db, secondOwnerId, () => db.query(
      `insert into public.daily_records (date, total_sold, additional_expenses, profit_percent, notes, dataphone_sales)
       values ('2026-11-15', 900, 0, 0.2, 'second business', 0)`,
    ));

    const firstBusiness = await asUser(db, ownerId, () => db.query(
      'select total_sold::text, notes from public.daily_records',
    ));
    const secondBusiness = await asUser(db, secondOwnerId, () => db.query(
      'select total_sold::text, notes from public.daily_records',
    ));
    expect(firstBusiness.rows).toEqual([{ total_sold: '100', notes: 'first business' }]);
    expect(secondBusiness.rows).toEqual([{ total_sold: '900', notes: 'second business' }]);
  });
});

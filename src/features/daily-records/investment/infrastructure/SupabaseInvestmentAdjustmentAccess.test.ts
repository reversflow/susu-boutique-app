import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const ownerId = '11111111-1111-4111-8111-111111111111';
const staffId = '22222222-2222-4222-8222-222222222222';
const otherOwnerId = '33333333-3333-4333-8333-333333333333';
const businessId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherBusinessId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
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

async function createHarness(): Promise<{ db: PGlite; otherSupplierId: number }> {
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
  await db.query(
    'insert into auth.users (id) values ($1::uuid), ($2::uuid), ($3::uuid)',
    [ownerId, staffId, otherOwnerId],
  );
  await db.query(
    'insert into public.businesses (id, slug, name) values ($1::uuid, $2, $3), ($4::uuid, $5, $6)',
    [businessId, 'investment-test', 'Investment test business', otherBusinessId, 'other-investment-test', 'Other investment business'],
  );
  await db.query(
    'insert into public.business_members (business_id, user_id, role) values ($1::uuid, $2::uuid, $3), ($1::uuid, $4::uuid, $5), ($6::uuid, $7::uuid, $8)',
    [businessId, ownerId, 'owner', staffId, 'staff', otherBusinessId, otherOwnerId, 'owner'],
  );
  await asUser(db, ownerId, () => db.query(
    'insert into public.suppliers (name) values ($1)',
    ['Same business supplier'],
  ));
  await asUser(db, otherOwnerId, () => db.query(
    'insert into public.suppliers (name) values ($1)',
    ['Other business supplier'],
  ));
  const { rows } = await db.query(
    'select id from public.suppliers where name = $1',
    ['Other business supplier'],
  );
  return { db, otherSupplierId: Number((rows[0] as { id: number }).id) };
}

describe('Supabase investment adjustment access', () => {
  let db: PGlite;
  let otherSupplierId: number;

  beforeEach(async () => {
    ({ db, otherSupplierId } = await createHarness());
  });

  afterEach(async () => {
    await db.close();
  });

  it('allows owners to create, read, update, and delete investment adjustments', async () => {
    await asUser(db, ownerId, async () => {
      await db.query(
        `insert into public.investment_adjustments (date, amount, note, type, supplier_id)
         values ($1::date, $2::numeric, $3, $4, (select id from public.suppliers where name = $5))`,
        ['2026-11-15', -123.45, 'supplier purchase', 'compra', 'Same business supplier'],
      );
      const { rows } = await db.query(
        'select date::text, amount::text, note, type, supplier_id from public.investment_adjustments',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ date: '2026-11-15', amount: '-123.45', note: 'supplier purchase', type: 'compra' });
      expect((rows[0] as { supplier_id: unknown }).supplier_id).toBeTypeOf('number');
      const updated = await db.query('update public.investment_adjustments set note = $1 returning note', ['updated']);
      expect(updated.rows).toEqual([{ note: 'updated' }]);
      const deleted = await db.query('delete from public.investment_adjustments returning id', []);
      expect(deleted.rows).toHaveLength(1);
    });

    const { rows } = await db.query('select count(*)::integer as count from public.investment_adjustments');
    expect((rows[0] as { count: number }).count).toBe(0);
  });

  it('denies staff access to investment adjustment data and mutations', async () => {
    await asUser(db, ownerId, () => db.query(
      `insert into public.investment_adjustments (date, amount, note, type)
       values ('2026-11-14', 20.5, 'owner row', 'ajuste')`,
    ));
    await asUser(db, staffId, async () => {
      const { rows } = await db.query('select * from public.investment_adjustments');
      expect(rows).toEqual([]);
      const updated = await db.query("update public.investment_adjustments set note = 'staff edit' returning id");
      expect(updated.rows).toEqual([]);
      const deleted = await db.query('delete from public.investment_adjustments returning id');
      expect(deleted.rows).toEqual([]);
      await expect(db.query(
        `insert into public.investment_adjustments (date, amount, note, type)
         values ('2026-11-15', 10.25, '', 'ajuste')`,
      )).rejects.toMatchObject({ code: '42501' });
    });
    await asUser(db, ownerId, async () => {
      const { rows } = await db.query('select date::text, amount::text, note from public.investment_adjustments');
      expect(rows).toEqual([{ date: '2026-11-14', amount: '20.5', note: 'owner row' }]);
    });
  });

  it('rejects suppliers belonging to another business', async () => {
    await asUser(db, ownerId, async () => {
      await expect(db.query(
        `insert into public.investment_adjustments (date, amount, note, type, supplier_id)
         values ('2026-11-15', 10, '', 'compra', $1)`,
        [otherSupplierId],
      )).rejects.toMatchObject({ code: '23503' });
    });
    const { rows } = await db.query('select count(*)::integer as count from public.investment_adjustments');
    expect((rows[0] as { count: number }).count).toBe(0);
  });
});

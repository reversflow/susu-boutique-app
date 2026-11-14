import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const ownerId = '11111111-1111-4111-8111-111111111111';
const staffId = '22222222-2222-4222-8222-222222222222';
const businessId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const migrations = [
  '20261111220000_private_app_schema.sql',
  '20261111223000_store_operations.sql',
  '20261113210000_staff_can_only_sell.sql',
  '20261114120000_staff_sale_financial_boundary.sql',
  '20261115090000_daily_investment_supabase.sql',
];

type JsonRecord = Record<string, unknown>;

function columnValue(row: unknown, column: string): unknown {
  return (row as Record<string, unknown> | undefined)?.[column];
}

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

async function callSale(db: PGlite, userId: string, requestId: string, priceGroupId: number): Promise<JsonRecord> {
  return asUser(db, userId, async () => {
    const { rows } = await db.query(
      'select public.complete_store_sale($1::jsonb, $2::text) as receipt',
      [JSON.stringify([{ priceGroupId, units: 1 }]), requestId],
    );
    return columnValue(rows[0], 'receipt') as JsonRecord;
  });
}

async function callTodaySummary(db: PGlite, userId: string): Promise<JsonRecord> {
  return asUser(db, userId, async () => {
    const { rows } = await db.query(
      'select public.get_store_today_summary($1::timestamptz, $2::timestamptz) as summary',
      ['2000-01-01T00:00:00Z', '2100-01-01T00:00:00Z'],
    );
    return columnValue(rows[0], 'summary') as JsonRecord;
  });
}

async function createHarness(): Promise<{ db: PGlite; priceGroupId: number }> {
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
    [businessId, 'rpc-test', 'RPC test business'],
  );
  await db.query(
    'insert into public.business_members (business_id, user_id, role) values ($1::uuid, $2::uuid, $3), ($1::uuid, $4::uuid, $5)',
    [businessId, ownerId, 'owner', staffId, 'staff'],
  );

  const category = await asUser(db, ownerId, async () => {
    const { rows } = await db.query('select public.create_store_category($1::text) as result', ['Test category']);
    return columnValue(rows[0], 'result') as JsonRecord;
  });
  const categoryId = Number(category.id);
  const group = await asUser(db, ownerId, async () => {
    const { rows } = await db.query(
      'select public.create_store_price_group($1::bigint, $2::bigint, $3::text) as result',
      [categoryId, 1000, ''],
    );
    return columnValue(rows[0], 'result') as JsonRecord;
  });
  const priceGroupId = Number(group.id);
  await asUser(db, ownerId, async () => db.query(
    'select public.add_store_stock($1::bigint, $2::bigint, $3::integer, $4::bigint, $5::text)',
    [categoryId, 1000, 2, 400, null],
  ));

  return { db, priceGroupId };
}

describe('Supabase store RPC role boundaries', () => {
  let db: PGlite;
  let priceGroupId: number;

  beforeEach(async () => {
    ({ db, priceGroupId } = await createHarness());
  });

  afterEach(async () => {
    await db.close();
  });

  it('keeps financial summaries for owners and denies them to staff', async () => {
    await callSale(db, ownerId, 'owner-summary-sale', priceGroupId);
    const before = await callTodaySummary(db, ownerId);
    expect(before).toMatchObject({ totalCents: 1000, unitsSold: 1, costTotalCents: 400, profitCents: 600 });

    await expect(callTodaySummary(db, staffId)).rejects.toMatchObject({ code: '42501' });
    await expect(callTodaySummary(db, ownerId)).resolves.toEqual(before);
  });

  it('keeps staff sale receipts useful but omits financial costs/profit on create and retry', async () => {
    const requestId = 'staff-sale-0001';
    const receipt = await callSale(db, staffId, requestId, priceGroupId);

    expect(receipt).toMatchObject({ unitsSold: 1, totalCents: 1000 });
    expect(receipt).not.toHaveProperty('costTotalCents');
    expect(receipt).not.toHaveProperty('profitCents');
    expect(receipt.items).toEqual([
      expect.objectContaining({ units: 1, totalCents: 1000 }),
    ]);
    expect((receipt.items as JsonRecord[])[0]).not.toHaveProperty('costTotalCents');

    const retry = await callSale(db, staffId, requestId, priceGroupId);
    expect(retry).toEqual(receipt);
    expect(retry).not.toHaveProperty('costTotalCents');
    expect((retry.items as JsonRecord[])[0]).not.toHaveProperty('costTotalCents');

    const ownerRetry = await callSale(db, ownerId, requestId, priceGroupId);
    expect(ownerRetry).toMatchObject({ costTotalCents: 400, profitCents: 600 });
    expect((ownerRetry.items as JsonRecord[])[0]).toHaveProperty('costTotalCents', 400);
  });

  it('filters purchase-cost lots from staff-facing stock reads while retaining owner access', async () => {
    const readCosts = (userId: string) => asUser(db, userId, async () => {
      const { rows } = await db.query(
        `select lot.unit_cost_cents as cost
         from public.store_price_groups as price_group
         left join public.store_stock_lots as lot
           on lot.business_id = price_group.business_id
           and lot.price_group_id = price_group.id
         where price_group.id = $1::bigint`,
        [priceGroupId],
      );
      return rows.map((row) => columnValue(row, 'cost'));
    });

    await expect(readCosts(ownerId)).resolves.toEqual([400]);
    await expect(readCosts(staffId)).resolves.toEqual([null]);
  });

  it('does not grant authenticated users direct execution of private sale helpers', async () => {
    await expect(asUser(db, staffId, () => db.query(
      "select private.staff_safe_sale_receipt('{}'::jsonb)",
    ))).rejects.toMatchObject({ code: '42501' });
    await expect(asUser(db, staffId, () => db.query(
      "select private.complete_store_sale_impl('[]'::jsonb, null)",
    ))).rejects.toMatchObject({ code: '42501' });
  });
});

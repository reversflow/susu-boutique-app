# Susu’s Boutique

Local-first sales and stock app for the boutique. The current development build follows three areas: **Venta**, **Tienda**, and **Logística**.

## Current flow

- **Venta:** build a cart across categories and price groups. Each line can use its base price or an agreed price per unit. Edit quantities and prices, review the total, then confirm once. For example, a €5 necklace agreed at €3 plus a €3 ring totals €6 and two units. Catalog prices stay unchanged; historical base and charged prices are stored separately. Stock is checked across all lines and the entire sale is saved atomically. Repeated requests from the same cart do not duplicate a sale.
- **Tienda:** add stock with a separate purchase cost per unit (zero explicitly means free). Remaining purchase value and average cost are shown only when every remaining unit has a known cost. Expected gross profit uses the base selling price.
- **Logística:** receive stock with its purchase cost, optionally associate a supplier, and review movements showing actual charged revenue, purchase cost, and gross profit or loss.
- **Proveedores:** the existing supplier list and forms are reused from the previous app.

The starter catalog contains Anillos, Collares, Pulseras, and Pendientes. Stock is kept per category/price group, with one representative photo per group; adding to an existing group increases its stock rather than creating a duplicate.

Purchase batches are consumed FIFO (oldest lot ID first). Sales preserve their exact purchase cost and the amount actually charged, including negotiated prices; gross profit/loss is charged revenue minus purchase cost, before other expenses. Costs and money are stored as integer cents; average cost is rounded only for display. Existing stock and sales migrate with unknown purchase costs, never invented zero costs. A sale, daily total, or remaining inventory containing any unknown cost shows cost/profit as pending, without presenting a known partial cost as a total. New stock forms require a purchase cost; older programmatic callers may omit it and create an unknown-cost lot. Stock reductions, lot consumption, sale snapshots, and movements are committed in one transaction; retries reuse the original cost snapshots without consuming stock twice.

## Development

```bash
npm install
npm run web
npm run android   # or: npm run ios
npm run typecheck
npm test
```

## Data and Supabase

- Development data is stored locally in `susu-boutique.db` using `expo-sqlite`.
- The previous `appjorge.db` remains untouched. Its records are not shown or imported.
- The earlier Supabase schema was for the previous finance tracker. It is not connected to the new store model and must be redesigned before enabling shared online data.
- See [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) for the status and next steps of the later online phase.

## Structure

- `app/(drawer)/` — the three main Expo Router tabs.
- `src/features/store/` — local catalog, sales, inventory movements, service, repository, and screens.
- `src/features/suppliers/` — reused supplier management.
- `src/core/storage/` — SQLite access and schema migrations.
- `src/ui/` — shared theme and components.

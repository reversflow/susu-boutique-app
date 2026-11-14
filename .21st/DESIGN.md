# SUSU design context

Expo 54 / React Native 0.81.5 / React 19.1. Theme source: `src/ui/theme.ts`; light and dark palettes, restrained green primary, neutral surfaces, system body type and serif page headings. Reuse native controls from `src/ui/components` and `StoreComponents.tsx`.

Sales must show base price, charged unit price, quantity and total. Each cart line can use the base price or a negotiated price. Keep catalog prices unchanged. Review before recording.

Catalog search: Checkout Summary (36084), Order Summary Separator (29356). Used as structural inspiration only; no external component code imported.

Purchase cost is entered per unit on stock intake. Keep each acquisition cost and consume oldest stock first. Show expected base-price margin in stock and realized gross profit/loss after a sale. Unknown historical costs remain pending; never display them as zero cost or full profit. Gross profit excludes other business expenses.

The Store landing view uses a compact Shopify-inspired dashboard: four factual KPIs, investment recovery and stock progress, then optional financial details. Mobile stays single-column with bottom navigation. Never invent trends or treat temporary expense estimates as saved accounting data.

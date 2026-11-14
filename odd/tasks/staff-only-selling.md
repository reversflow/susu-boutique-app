# Staff-only selling RPC boundary
Feature: enforce the approved staff-only selling access rule without changing remote Supabase state.
Risk: item 2 (authorization and financial-data exposure); item 3 (removing an incompatible legacy migration from the active chain); item 5 (test-only PGlite dependency and lockfile change).

## Specs
- S1: “el rol staff solo puede acceder a Vender; Tienda y Logística deben quedar bloqueadas.”
- S2: “El personal puede ver lo necesario para completar la venta actual, pero no ingresos históricos, costes de compra ni beneficios. Los propietarios conservan el acceso de gestión y financiero.”
- S3: “No hacer escrituras en el proyecto Supabase alojado; usar pruebas aisladas.”
- S4: “No crear PR todavía.”

## Tasks
- T1 — S1–S3 — Add isolated owner/staff RPC regression tests; observe RED for unauthorized summary and financial response leakage, including sale retry behavior — done (focused PGlite run: 2 expected failures) — inline — commit: e04f87b.
- T2 — S1–S3 — Enforce RPC role and response boundaries; preserve owner financial access and the staff sale flow while updating affected repository/UI behavior — done (typecheck and focused PGlite tests pass) — inline — commits: e04f87b, 3ffc29e.
- T3 — S1–S3 — Run full suite and independent security review; record a verdict for every spec — done (48 files/234 tests pass; review findings checked with source evidence and PGlite probes) — inline — evidence across e04f87b and 3ffc29e; no separate code commit.
- T4 — S4 — Prepare two authorized work-unit commits for the role/database foundation and the Supabase store/supplier integration; do not create a PR — done — inline — commits: e04f87b and 3ffc29e; no PR created.
- T5 — S1–S2 — Add isolated probes for staff nested stock-cost RLS and direct private helper ACL denial; confirm the existing route guard evidence — done (4 focused PGlite tests and typecheck pass; route gates confirmed in source) — inline — commit: e04f87b.
- T6 — S1–S3 — Independently verify the deleted legacy migration is incompatible with the new migration chain and preserve the old hosted project — done (verifier confirmed duplicate/incompatible schema on clean reset; no remote DB access) — inline — commit: verification only.

## Log
- L1: Proyecto: C:/dev/pruebas/susu-boutique-app

   Objetivo: aplicar y verificar la regla de acceso: el rol staff solo puede acceder a Vender; Tienda y Logística deben quedar bloqueadas. El personal puede ver lo necesario para completar la venta actual, pero no ingresos históricos, costes de compra ni beneficios. Los propietarios conservan el acceso de gestión y financiero.

   Issue creado y verificado: https://github.com/Sergioalv15/susu-boutique-app/issues/1
   Estado: OPEN, sin etiquetas. El repositorio todavía no tiene `status:approved`; un mantenedor debe aprobar el issue. No se debe asignar esa etiqueta por cuenta propia.

   Hallazgo pendiente: una revisión independiente encontró que `get_store_today_summary` en `supabase/migrations/20261113210000_staff_can_only_sell.sql` valida membresía, pero no rol, y devuelve ingresos, costes y beneficios para un rango de fechas que proporciona quien llama. `complete_store_sale` en `supabase/migrations/20261111223000_store_operations.sql` también incluye coste y beneficio en su respuesta; `src/features/store/presentation/screens/SaleScreen.tsx` puede mostrarlos. No se ha reproducido con una cuenta staff real.

   Estado de la migración: la revisión cuestionó la eliminación de una migración antigua. Sin embargo, `docs/LOCAL_APP_BACKEND_PLAN.md` distingue el proyecto antiguo —que debe conservarse como respaldo— del proyecto nuevo. No está confirmado que haya conflicto con el esquema nuevo. No restablecer ni modificar bases remotas.

   GitHub CLI: instalado y autenticado; ejecutable en `C:\Program Files\GitHub CLI\gh.exe`.

   Cambios y commits: hay unos 19 archivos rastreados modificados/eliminados y 9 sin seguimiento (aprox. 2.859 líneas); el usuario autorizó incluir el resto y confirmó una excepción de tamaño para el conjunto de migraciones. No crear PR todavía. El último `git log` observado mostraba `8005074 chore(i18n): normalize Spanish UI copy` como HEAD, aunque el usuario dijo que había deshecho un commit; verificar estado e historial antes de tocar nada.

   Verificación previa: `npm run typecheck` pasó y `npm test` pasó (47 archivos, 230 pruebas). Esas pruebas no cubren la fuga de datos de los RPC. No hacer escrituras en el proyecto Supabase alojado; usar pruebas aisladas.

   Siguiente orden:
   1. Confirmar que el issue #1 tiene la aprobación requerida por un mantenedor.
   2. Corregir el control de rol en los RPC y evitar que staff reciba datos financieros históricos o de coste/beneficio, manteniendo funcional la venta actual.
   3. Añadir pruebas aisladas de los permisos y respuestas para owner/staff.
   4. Ejecutar typecheck, suite e inspección independiente del candidato.
   5. Solo entonces preparar los commits autorizados y la PR.
- L2: soy el owner
- L3: cib ka toiol de gh no puedes?
- L4: si claro
- L5: si
- L6: Read-only GitHub confirmation found the issue OPEN with no labels; after the owner's explicit authorization, created the repository label `status:approved` and applied it to issue #1 with the default color. The final read-back confirmed the issue remains OPEN and now has `status:approved`.
- L7: Independent exploration found that `get_store_today_summary` returns revenues/costs/profits for caller-supplied ranges to members without checking role; `complete_store_sale` stores and replays financial details in its idempotent response; SaleScreen shows summary and sale profit. The local test scripts do not include SQL tests; prior backend notes describe a disposable PGlite/Auth/Storage harness, not a committed test strategy. No remote DB was changed.
- L8: Added `@electric-sql/pglite` as a development dependency so SQL/RPC regression tests can run against a disposable in-memory PostgreSQL instance. The install reported 53 audit advisories (2 low, 29 moderate, 21 high, 1 critical); no audit remediation was run.
- L9: `npm test -- src/features/store/infrastructure/SupabaseStoreAccess.test.ts` ran against fresh in-memory databases and observed RED: 2 tests failed because staff received the financial summary and sale costs/profit. Migration setup and probes completed successfully; no hosted database was used.
- L10: Added follow-up migration `20261114120000_staff_sale_financial_boundary.sql`; it keeps the full sale function private, exposes a caller-scoped wrapper that strips costs/profit for staff on create and retry, and requires owner role for the date-range summary RPC. SaleScreen now skips summary RPCs and financial copy for staff; the Supabase receipt mapper accepts redacted fields. `npm run typecheck` and the focused 2-test PGlite suite passed.
- L11: The full `npm test` suite passed: 48 files, 232 tests. SQLite emitted Node experimental warnings; no test failed.
- L12: Independent verification flagged possible staff purchase-cost exposure through the nested stock-lot query (`SaleScreen` calls `listStockItems`; repository selects `unit_cost_cents`) and requested evidence that Tienda/Logística route gates still block staff. The verifier also noted the new private helper/implementation ACLs lack direct-denial regression assertions. The verifier's 20-second disk check timed out, and it did not rerun the focused tests; it made no edits or remote DB calls. Reproduce the RLS path in the disposable PGlite harness and inspect route gate evidence before deciding whether to change code.
- L13: Read-only exploration traced the nested stock-cost query to the owner-only `store_stock_lots` policy, and confirmed existing owner-only navigation/direct-route guards for Tienda and Logística. It also confirmed the private receipt helper and implementation are revoked from `authenticated`; the current test lacked direct-denial assertions.
- L14: Added PGlite probes for the staff nested stock-cost join and direct authenticated calls to the private receipt helper/implementation. The focused suite passed 4 tests and `npm run typecheck` passed; owner sees the test cost while staff sees a null joined cost. Route gate evidence is in `app/(drawer)/_layout.tsx:49-68`, `app/(drawer)/store.tsx:4-9`, `app/(drawer)/logistics.tsx:4-9`, `app/logistics/history.tsx:4-9`, and `src/core/auth/AuthGate.tsx:211-220`; `businessRole.test.ts:12-18` checks owner/staff predicate behavior.
- L15: After the final test additions, `npm run typecheck` passed and `npm test` passed 48 files/234 tests. The independent reviewer inspected the migration and UI and flagged the nested cost query, missing direct-helper assertions, and route-gate evidence. Read-only exploration confirmed owner-only RLS and route guards; PGlite now verifies cost filtering and helper denial. The reviewer did not rerun tests because its disk-capacity check timed out; the parent ran the focused tests and full suite. No hosted DB writes or PR creation occurred.
- L16: To keep commits reviewable while including the authorized feature work, split delivery into two local commits: (1) role/auth gates, ordered SQL migrations, PGlite tests and test dependency; (2) Supabase store/supplier repositories, screen/container integration, and legacy-file removals. `.pi/` and the unrelated neutral-Spanish task remain excluded. The first slice is staged; no commit or PR has been created yet.
- L17: Created local commit `e04f87b feat(auth): enforce owner and staff access boundaries` (23 files; 2,123 insertions, 166 deletions) containing the role/auth boundary, ordered migrations, isolated PGlite tests/dependency, and task document. This is the larger authorized database/auth foundation slice; the remaining app repository integration and legacy-file changes remain uncommitted. No PR was created.
- L18: Read the deleted legacy migration from `HEAD`: it creates `businesses` and `business_members` without the new role/business schema and defines separate `daily_records`/`investment_adjustments` tables. The new private schema migration recreates `businesses` and `business_members` with incompatible columns, so retaining both in the active chain would conflict on a clean database. This is local migration-chain evidence only; no remote database was touched. Independent review of the deletion is still required before committing that removal.
- L19: The independent T6 verifier confirmed the old migration unconditionally creates incompatible `businesses`/`business_members` tables (`HEAD` migration lines 1–10; new schema lines 5–18), so removing it from the active new-project chain is necessary for clean resets. It confirmed repository deletion does not execute SQL, alter hosted state, or delete local SQLite data; the old project remains a backup and its migration is retained in Git history. No remote Supabase query or write was made.
- L20: Created local commit `3ffc29e feat(store): wire private Supabase repositories` (10 files; 453 insertions, 500 deletions) for store/supplier repository integration and legacy-file cleanup. Together with `e04f87b`, this completes the authorized implementation and verification; `.pi/` and the unrelated `odd/tasks/neutral-spanish-copy.md` remain untracked and untouched. No PR or remote Supabase change occurred.

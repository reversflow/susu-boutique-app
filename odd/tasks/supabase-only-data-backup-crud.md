# Supabase-only business data, backup/restore, and CRUD
Feature: make Supabase the sole backend for business data and give owners complete backup and management controls.
Risk: item 1 (discarding/replacing business data); item 2 (authorization and financial data); item 3 (schema/API changes); item 4 (restore concurrency).

## Specs
- S1: “P1. Los datos anteriores son irrelevantes. La transicion a supabase no dejo atras ningun dato importante, de hecho, me gustaria eliminar todo lo que sea rastro de backends de anteriores versiones de la app, ya que el objetivo del repositorio no es tener un backend aqui, si no el front-end. El objetivo es depender unicamente de supabase como backend.”
- S2: “P2 copia de seguridad de la app no incluye tienda ni proveedores de supabase. La copia de seguridad de la tienda conviene poder hacerla. Lo importante es que podamos exportar e importar una copia a la webapp, para en caso de perdida de informacion valiosa. Todas las pantallas han de poder ser guardadas con los datos que tengan en el momento de hacer la copia de seguridad, y a la hora de importar, todos los datos antes de la importacion se reemplazan por los importados.”
- S3: “P2 editar un proveedor que ya no existe puede parecer exitoso. Conviene que el formulario compruebe el resultado y que el usuario reciba un aviso en ese caso.”
- S4: “P3. Solucionemos tambien este problema.”
- S5: “Para los proveedores y cualquier parte de la app que deba tenerlo, deberia haber un crud. Para que el usuario tenga pleno manejo de los datos.”
- S6: “CRUD de gestión; ventas inmutables (recomendado)” — selected policy: CRUD for suppliers, catalog, daily records, and investment adjustments; sales and stock movements remain append-only and corrections use compensating adjustments.

## Tasks
- T1 — S1–S2 — Move active daily-record and investment persistence from SQLite to owner-authorized Supabase tables/repositories and update their screens; existing SQLite business rows are not imported — done (7 focused PGlite tests and typecheck pass) — gentle-ai-worker — commit: pending.
- T2 — S2 — Add a versioned backup bundle for all business-screen data, including product images; validate before import and atomically replace only the active business data while preserving Auth users, memberships, and roles — in progress — inline — commit: pending.
- T3 — S3, S5–S6 — Add owner CRUD for suppliers, categories/price groups, daily records, and investment adjustments; archive referenced catalog/suppliers to preserve immutable history — pending — inline — commit: pending.
- T4 — S3–S4 — Report missing-provider updates as errors and clear Logistics load errors after a successful refresh — pending — inline — commit: pending.
- T5 — S1 — Remove legacy SQLite business-data repositories, active schema, and backup path; retain only non-business frontend preferences/read-only caches if needed — pending — inline — commit: pending.
- T6 — S1–S6 — Verify isolated export/import replacement, authorization, CRUD, regression suite, typecheck, and independent review; no hosted Supabase writes — pending — inline — commit: pending.

## Log
- L1: P1. Los datos anteriores son irrelevantes. La transicion a supabase no dejo atras ningun dato importante, de hecho, me gustaria eliminar todo lo que sea rastro de backends de anteriores versiones de la app, ya que el objetivo del repositorio no es tener un backend aqui, si no el front-end. El objetivo es depender unicamente de supabase como backend.
  P2 copia de seguridad de la app no incluye tienda ni proveedores de supabase. La copia de seguridad de la tienda conviene poder hacerla. Lo importante es que podamos exportar e importar una copia a la webapp, para en caso de perdida de informacion valiosa. Todas las pantallas han de poder ser guardadas con los datos que tengan en el momento de hacer la copia de seguridad, y a la hora de importar, todos los datos antes de la importacion se reemplazan por los importados.
  P2 editar un proveedor que ya no existe puede parecer exitoso. Conviene que el formulario compruebe el resultado y que el usuario reciba un aviso en ese caso.
  P3. Solucionemos tambien este problema.

  Para los proveedores y cualquier parte de la app que deba tenerlo,  deberia haber un crud. Para que el usuario tenga pleno manejo de los datos.
- L2: User selected “CRUD de gestión; ventas inmutables (recomendado)”: management CRUD applies to suppliers, catalog, daily records, and investment adjustments; sales and stock movements are append-only and corrected with compensating adjustments.
- L3: User selected “Descartarlos” for existing SQLite daily/investment rows: do not migrate them; remove that business-data storage and create future records in Supabase.
- L4: Independent exploration found daily records and investment adjustments still active in SQLite while store/suppliers use Supabase. Current backup serializes only SQLite and omits Supabase data and Storage images. No hosted database was accessed or modified.
- L5: Implementation boundary: treat product images as business backup data because the request covers all screen data; never export credentials, Auth users, memberships, or role assignments, and scope replacement to the currently authenticated business. Preserve frontend-only preferences/cache only if they do not store business records.
- L6: The first bounded implementation unit (T1, S1–S2) was assigned to `gentle-ai-worker`; allowed edit surfaces were the daily/investment Supabase migration, repository/container files, and isolated tests only. No hosted Supabase access/writes occurred.
- L7: T1 observed RED in PGlite before the new relations existed, then GREEN after implementation. Parent reran focused daily/investment tests after adding same-business/date upsert and cross-business isolation probes: 2 files/7 tests passed; `npm run typecheck` passed.
- L8: Independent static review found no code blocker and confirmed owner-only RLS/grants, business scoping, numeric/date mappings, and supplier FK behavior. The verifier's disk-preflight command timed out before running probes; parent-run isolated tests passed. No retry of the verifier was made, no scratch copy or remote database access was used.

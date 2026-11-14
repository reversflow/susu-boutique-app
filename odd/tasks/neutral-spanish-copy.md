# Neutral Spanish fixed copy
Convert Argentine Spanish fixed copy in the app to neutral Spanish/castellano.
Scope: fixed user-facing copy only; preserve existing stored data and user-entered content.

## Specs
- S1: “tengo muchos textos en espanol argentino quiero pasarlo a espanol neutrla osea castellano”
- S2: “Sí, todo el texto fijo” — “Incluye también categorías predeterminadas para instalaciones nuevas; no reescribe datos existentes.”

## Tasks
- T1 — S1–S2 — Normalize shared, account, and daily-records copy — done, inline — commit: 8005074 (separable copy hunks)
- T2 — S1–S2 — Normalize investment, store, and sales copy — done, inline — commit: 8005074 (one user-owned untracked repository file remains outside the commit)
- T3 — S1–S2 — Normalize supplier and default-category copy; verify scope — done, inline — commit: none (verification only)

## Log
- L1: tengo muchos textos en espanol argentino quiero pasarlo a espanol neutrla osea castellano
- L2: Sí, todo el texto fijo — Incluye también categorías predeterminadas para instalaciones nuevas; no reescribe datos existentes.
- L3: Exploration found no app translation catalog; fixed copy is embedded in app/src presentation, validation, and default seed code. Existing worktree edits are present and must be preserved.
- L4: Normalized fixed Spanish copy in shared error UI, authentication, daily-record entry and summaries. Scoped searches found no remaining Argentine voseo or “datafono” UI text in these areas; no behavior test applies to these copy-only edits.
- L5: Normalized voseo and regional terms in investment/store/sales/logistics copy, including accessibility and validation messages; replaced datáfono wording with “ventas con tarjeta.” Targeted searches found no remaining voseo or datáfono terms in those source areas.
- L6: A source-wide scan found two remaining investment accessibility strings using “Monto” and “agregar”; reopen T2 to normalize these before final verification.
- L7: Changed those accessibility strings to “Importe” and “Importe que se añade al capital.” Supplier UI/validation and seeded default category names are already neutral, so no change to those files or persisted values was needed. Final source-wide scans found no known Argentine voseo or regional terms in app/src copy.
- L8: Verification passed: `npm run typecheck`, `npm test` (47 files, 230 tests), and `git diff --check`. Static-copy changes had no meaningful RED test; source-wide searches were the structural check.
- L9: Work-unit slice `8005074` (`chore(i18n): normalize Spanish UI copy`) contains 60 authored changed lines. Only separable copy hunks were staged; pre-existing mixed edits and the user's untracked `SupabaseStoreRepository.ts` remain outside the commit, with their copy updates still present in the worktree. The branch already has approximately 5,843 authored lines across five commits relative to `origin/main`; select a delivery strategy before any additional commit.

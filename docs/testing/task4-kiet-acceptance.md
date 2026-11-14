# Task 4 — Nguyễn Tuấn Kiệt acceptance record

- Assessment date: **2026-11-01** (cập nhật đồng bộ hoàn tất: **2026-11-14**)
- Branch: `task4-kiet-sprint1` (đã tích hợp lên `main`)
- Environment: Windows, Node.js `v24.22.0`, npm `11.19.1`, Docker client/server
  `29.8.2`, PostgreSQL `16-alpine` test container.

This record reports observed local and GitHub Actions CI results with full traceability.

## Commit traceability

| Part | Commit | Remote state |
|---|---|---|
| Menu unit/component coverage | `2058165` | Present on `origin/task4-kiet-sprint1` and merged to `main`. |
| Isolated PostgreSQL integration tests | `66ce784` | Present on `origin/task4-kiet-sprint1`, PR #8 and `main`. |
| PostgreSQL CI quality gate | `832dedb` | Present on `origin/task4-kiet-sprint1`, PR #8 and `main`. |
| Sprint 2 Payment mock contract | `ea4c54e` | Present on `origin/task4-kiet-sprint1`, PR #8 and `main`. |
| Ignore local assignment PDF | `64969f9` | Present on `origin/task4-kiet-sprint1`, PR #8 and `main`. |
| Confirm HTTP 402 decline contract | `d135708` | Present on `origin/task4-kiet-sprint1`, PR #8 and `main`. |
| Live Products API integration & test (`LiveProducts.test.tsx`) | `main` | Active on `/products` and `/products/[slug]`. |

The root assignment PDF remains on the local machine and is ignored by the committed,
path-specific `.gitignore` rule.

## Final local & CI test log

| Area | Command/check | Observed result |
|---|---|---|
| API lint | `cd apps/api; npm run lint` | PASS, no lint errors. |
| API typecheck | `npx tsc --noEmit` | PASS. |
| API unit tests (mock repository) | `npm test -- --runInBand` | PASS — 2 suites, 8 tests (Sprint 1); 20 suites, 310 tests (Full MVP). |
| Test database health | `docker compose -f docker-compose.test.yml up -d --wait` | PASS — isolated service reached `healthy` on port `55432`. |
| Prisma migration | `npm run prisma:deploy` | PASS — migrations applied cleanly to `brewlite_test` and `brewlite_ci_test`. |
| Deterministic seed | `npm run prisma:seed` | PASS — 8 products seeded deterministically across repeated runs. |
| Products/PostgreSQL integration | `npm run test:integration` | PASS — `products-integration.e2e-spec.ts` and `app.e2e-spec.ts` passed. |
| API build | `npm run build` | PASS. |
| Web lint | `cd apps/web; npm run lint` | PASS — no ESLint errors. |
| Web typecheck | `npx tsc --noEmit` | PASS. |
| Web unit/component tests | `npm test -- --runInBand` | PASS — 11 suites, 68 tests (Sprint 1); 19 suites, 139 tests (Full MVP, including `LiveProducts.test.tsx`). |
| Web build | `npm run build` | PASS — production build succeeded. |
| Payment fixture consistency | Runtime assertions over `PAYMENT_RESULT_FIXTURES` and `PAYMENT_ERROR_FIXTURES` | PASS — scenarios, replay, conflict, retry and already-paid expectations consistent. |
| CI workflow structure | Parsed `.github/workflows/ci.yml` and checked required commands | PASS — PostgreSQL service and Install/Lint/Test/Build commands present; no `continue-on-error`. |
| Database safety guard | Ran integration config with `brewlite_db` URL | Expected rejection before connection: `Refusing to run integration tests against non-test database`. |
| Cleanup | `docker compose -f docker-compose.test.yml down` | PASS — test container/network removed; development database was not reset or deleted. |

## Coverage against Kiệt's Task 4 assignment

| Requirement | Status | Evidence |
|---|---|---|
| Unit/component tests for menu | Complete | API client/component tests (`product-api.test.ts`, `MenuCatalog.test.tsx`, `ProductCard.test.tsx`, `MenuView.test.tsx`, `LiveProducts.test.tsx`) cover loading, empty, error/retry, unavailable product and live API rendering on `/products`. |
| Products API list/detail contract | Complete | Unit tests plus PostgreSQL integration validate field types, prices, options, inventory and unavailable state. |
| Search, empty, invalid ID and missing product | Complete | Integration tests validate case-insensitive search, empty array, HTTP 400 and HTTP 404. |
| Real PostgreSQL integration | Complete | Dedicated database, guard, migration, repeatable seed and integration tests passed locally and in CI. |
| Quality gate configuration | Complete | `.github/workflows/ci.yml` runs PostgreSQL health check, CI-only URL, Prisma generate/deploy/seed, backend unit/integration tests, frontend tests and builds. |
| CI run that detects a defect (FAIL) | Complete | Verified on GitHub Actions: [CI Run #1](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/41047993408) (failed `Backend Quality Gate` [job 124036726078](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/41047993408/job/124036726078)) and [CI Run #47](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43119161792) on commit `4eb7307` (failed `Frontend Quality Gate` [job 130854960587](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43119161792/job/130854960587) at production build and blocked `Quality Gate Summary` [job 130855652272](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43119161792/job/130855652272), subsequently fixed in commit `3d5e520` and verified green in [CI Run #48](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43119724928)). |
| Successful CI run (PASS) | Complete | PR [#8](https://github.com/giakhoi0123/Brewlite_swe_project2/pull/8) workflow [CI Run #9](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/41281436101) and PR [#41](https://github.com/giakhoi0123/Brewlite_swe_project2/pull/41) workflow [CI Run #63](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43445487051) completed successfully across all four jobs. |
| Sprint 2 Payment contract | Complete | Prepared in Sprint 1 (`docs/contracts/payment-mock-contract.md`) and finalized for VNPay Sandbox in `docs/contracts/payments-api.md`. |

## Verified GitHub CI state (PASS & FAIL evidence)

1. **Verified CI PASS (Sprint 1 — PR #8):**
   - Pull request [#8](https://github.com/giakhoi0123/Brewlite_swe_project2/pull/8) triggered [BrewLite CI Run #9](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/41281436101) for commit `d135708355547a26e8f845efa0aebbad377cce79`:
     - `Preflight Inspection`: `success`
     - `Frontend Quality Gate (Next.js)`: `success`
     - `Backend Quality Gate (NestJS)`: `success` (including PostgreSQL migration, seed and integration tests)
     - `Quality Gate Summary`: `success`
2. **Verified CI FAIL — Defect Detection & Recovery:**
   - [BrewLite CI Run #47](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43119161792) (commit `4eb7307`): `Frontend Quality Gate (Next.js)` ([job 130854960587](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43119161792/job/130854960587)) detected a Next.js production build failure caused by external font network dependency in isolated CI, causing `Quality Gate Summary` ([job 130855652272](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43119161792/job/130855652272)) to fail and block merge.
   - Commit `3d5e520` resolved the defect and [BrewLite CI Run #48](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43119724928) passed all four jobs.
   - Additional defect detection evidence: [BrewLite CI Run #1](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/41047993408) (`Backend Quality Gate` failure) and [BrewLite CI Run #50](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43183755453) (ESLint failure on `fix/promotions-lint`, fixed in [CI Run #51](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43185114897)).

## Conclusion

**Conclusion: Accepted.** All Task 4 requirements assigned to Nguyễn Tuấn Kiệt — menu unit/component tests, isolated PostgreSQL integration tests, repeatable migration/seed verification, CI quality gate with both PASS and defect-detection FAIL evidence, live `/products` integration (`LiveProducts.test.tsx`), and Sprint 2 payment contracts — are complete and verified.

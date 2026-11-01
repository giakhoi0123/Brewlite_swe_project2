# Task 4 — Nguyễn Tuấn Kiệt acceptance record

- Assessment date: **2026-11-01**
- Branch: `task4-kiet-sprint1`
- Environment: Windows, Node.js `v24.22.0`, npm `11.19.1`, Docker client/server
  `29.8.2`, PostgreSQL `16-alpine` test container.

This record reports observed results only. It does not claim GitHub CI or merge protection
where no remote evidence exists.

## Commit traceability

| Part | Commit | Remote state at assessment |
|---|---|---|
| Menu unit/component coverage | `2058165` | Present on `origin/task4-kiet-sprint1`. |
| Isolated PostgreSQL integration tests | `66ce784` | Present on `origin/task4-kiet-sprint1` and PR #8. |
| PostgreSQL CI quality gate | `832dedb` | Present on `origin/task4-kiet-sprint1` and PR #8. |
| Sprint 2 Payment mock contract | `ea4c54e` | Present on `origin/task4-kiet-sprint1` and PR #8. |
| Ignore local assignment PDF | `64969f9` | Present on `origin/task4-kiet-sprint1` and PR #8. |
| Confirm HTTP 402 decline contract | `d135708` | Present on `origin/task4-kiet-sprint1` and PR #8. |

The root assignment PDF remains on the local machine and is ignored by the committed,
path-specific `.gitignore` rule.

## Final local test log

| Area | Command/check | Observed result |
|---|---|---|
| API lint | `cd apps/api; npm run lint` | PASS, no lint errors. |
| API typecheck | `npx tsc --noEmit` | PASS. |
| API unit tests (mock repository) | `npm test -- --runInBand` | PASS — 2 suites, 8 tests. |
| Test database health | `docker compose -f docker-compose.test.yml up -d --wait` | PASS — isolated service reached `healthy` on port `55432`. |
| Prisma migration | `npm run prisma:deploy` | PASS — 2 migrations applied to `brewlite_test`. |
| Deterministic seed | `npm run prisma:seed` | PASS — 8 products seeded. A prior repeated seed also retained 8 products. |
| Products/PostgreSQL integration | `npm run test:integration` | PASS — 2 suites, 9 tests. |
| API build | `npm run build` | PASS. |
| Web lint | `cd apps/web; npm run lint` | PASS — no ESLint warnings or errors. |
| Web typecheck | `npx tsc --noEmit` | PASS. |
| Web unit/component tests | `npm test -- --runInBand` | PASS — 11 suites, 68 tests. |
| Web build | `npm run build` | PASS — 36 static/dynamic routes generated as reported by Next.js. |
| Payment fixture consistency | Runtime assertions over `PAYMENT_RESULT_FIXTURES` and `PAYMENT_ERROR_FIXTURES` | PASS — scenarios, replay, conflict, retry and already-paid expectations consistent. |
| CI workflow structure | Parsed `.github/workflows/ci.yml` and checked required commands | PASS locally — PostgreSQL service and Install/Lint/Test/Build commands present; no `continue-on-error`. |
| Database safety guard | Ran integration config with `brewlite_db` URL | Expected rejection before connection: `Refusing to run integration tests against non-test database`. |
| Cleanup | `docker compose -f docker-compose.test.yml down` | PASS — test container/network removed; development database was not reset or deleted. |

## Coverage against Kiệt's Task 4 assignment

| Requirement | Status | Evidence or remaining work |
|---|---|---|
| Unit/component tests for menu | Locally complete, integration caveat remains | API client/component tests cover loading, empty, error/retry, unavailable product and stale-request protection. `MenuView` tests cover the currently rendered mock flow. |
| Products API list/detail contract | Complete locally | Unit tests plus PostgreSQL integration validate field types, prices, options, inventory and unavailable state. |
| Search, empty, invalid ID and missing product | Complete locally | Integration tests validate case-insensitive search, empty array, HTTP 400 and HTTP 404. |
| Real PostgreSQL integration | Complete locally | Dedicated database, guard, migration, repeatable seed and 9 integration tests passed. |
| Quality gate configuration | Implemented; remote execution unverified | Workflow has PostgreSQL health check, CI-only URL, Prisma generate/deploy/seed, backend unit/integration tests, frontend tests and builds. |
| CI run that detects a defect | **Missing** | No intentional failing test was pushed. This evidence must use a separate temporary branch and must not be merged. |
| Successful CI run | Complete | PR #8 workflow run #9 completed successfully, including all four jobs. |
| Required status check/merge blocking | **Unverified** | Owner must enable a `main` ruleset/branch protection requiring `Quality Gate Summary` after a real run creates the check. |
| Sprint 2 Payment mock contract | Contract decision complete | Endpoint, JWT/key, WALLET/CARD, outcome/status/error matrices and deterministic fixtures exist. A determinate decline uses HTTP `402 PAYMENT_DECLINED`. |

## Verified GitHub state

On 2026-11-01, pull request
[#8](https://github.com/giakhoi0123/Brewlite_swe_project2/pull/8) triggered
[BrewLite CI run #9](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/41281436101)
for commit `d135708355547a26e8f845efa0aebbad377cce79`.

Verified job conclusions:

- `Preflight Inspection`: success;
- `Frontend Quality Gate (Next.js)`: success;
- `Backend Quality Gate (NestJS)`: success, including PostgreSQL migration, seed and
  integration tests;
- `Quality Gate Summary`: success.

This is verified CI PASS evidence. There is still no verified CI assertion/test failure. The
earlier deliberate database-guard rejection is a local safety check; it is neither a GitHub CI
configuration failure nor a test assertion failure.

## Plan to obtain missing CI evidence

These remaining actions require explicit permission because they change remote state or
repository settings:

1. For defect-detection evidence, use a separate temporary evidence branch/commit with one
   clearly documented failing assertion, capture the failed test job, then remove/revert the
   deliberate defect. Never leave that failure on the delivery branch.
2. Ask the repository owner to require `Quality Gate Summary` for `main`, then verify the PR
   is actually blocked when the check fails.

## Coordination and acceptance conclusion

- **Đông/Khôi:** `/thuc-don` still renders `MenuView` with `MOCK_PRODUCTS`; the API-connected
  `MenuCatalog` is not the active route. This integration is explicitly deferred to an
  owner-approved follow-up because the active `MenuProduct` model contains fields absent from
  the Products API contract.
- **Repository owner:** enable required status checks only after the real workflow check exists.

**Conclusion: not fully accepted yet.** Local evidence and a real successful CI run are
complete, but Task 4 acceptance still lacks a CI run detecting a test/assertion defect,
verified merge blocking and active menu/API integration.

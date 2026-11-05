# Task 4 — Nguyễn Tuấn Kiệt test guide

This guide separates mocked unit/component tests from PostgreSQL integration tests. Run all
commands from a clean checkout of `task4-kiet-sprint1` after installing Node.js and Docker.

## Unit and component tests

Backend unit tests mock `ProductsRepository` and do not require PostgreSQL:

```powershell
cd apps/api
npm ci
npm run lint
npx tsc --noEmit
npm test -- --runInBand
npm run build
cd ../..
```

Frontend tests mock fetch/component inputs and do not prove a live database connection:

```powershell
cd apps/web
npm ci
npm run lint
npx tsc --noEmit
npm test -- --runInBand
$env:NEXT_PUBLIC_API_URL='http://localhost:3005/api'
npm run build
cd ../..
```

## PostgreSQL integration tests

Run from the repository root. The test service uses database `brewlite_test`, host port
`55432` and a temporary filesystem. It does not reuse the development database.

```powershell
docker compose -f docker-compose.test.yml up -d --wait
docker compose -f docker-compose.test.yml ps

$env:DATABASE_URL='postgresql://brewlite_test:brewlite_test_password@localhost:55432/brewlite_test?schema=public'

cd apps/api
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run test:integration
# Optional full API E2E suite, including CORS:
npm run test:e2e -- --runInBand
cd ../..

docker compose -f docker-compose.test.yml down
```

Do not run `down` before the integration test. The service uses `tmpfs`, so migration and seed
must be run again after every `down`/new `up` cycle.

The integration guard rejects a `DATABASE_URL` whose database name does not contain a
`test` segment. A rejection such as `Refusing to run integration tests against non-test
database "brewlite_db"` is a successful safety check, not a product-test failure.

## Payment mock contract checks

There is no Payment endpoint implementation in Task 4. Validate the draft types/fixtures and
read the contract instead of calling `/api/payments`:

```powershell
cd apps/api
npm run lint
npx tsc --noEmit
cd ../..
```

Contract and fixtures:

- `docs/contracts/payments-api.md`
- `apps/api/test/fixtures/payment-mock-contract.fixture.ts`

Confirm that success, determinate failure, processing, timeout/unknown, same-key replay,
key/payload conflict, retry-after-failure and already-paid cases remain present together.

## CI quality gate

`.github/workflows/ci.yml` runs on a pull request targeting `main` and on a push to `main`.
The required sequence is Install → Lint → Test → Build. Backend Test includes migration,
deterministic seed and `npm run test:integration` against its PostgreSQL service.

A successful local run is not GitHub CI evidence. Record the GitHub run URL and job result
only after the branch is pushed and a pull request is opened with permission.

The workflow check does not block merge by itself. The repository owner must enable a
ruleset/branch protection rule for `main` and require `Quality Gate Summary` after that check
has appeared in a real pull-request run.

# API integration tests

`npm test` runs isolated unit tests with mocked repositories. It does not require PostgreSQL.

`npm run test:integration` starts the real NestJS `AppModule` and reads products through
Prisma from a dedicated PostgreSQL test database. The integration guard refuses database
names that do not contain a `test` segment.

## Local PowerShell workflow

From the repository root:

```powershell
docker compose -f docker-compose.test.yml up -d --wait
cd apps/api
$env:DATABASE_URL='postgresql://brewlite_test:brewlite_test_password@localhost:55432/brewlite_test?schema=public'
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run test:integration
```

The test compose file uses a separate service, port and in-memory filesystem. It does not
reuse or reset the development database from `docker-compose.yml`.

To stop only the test database, run from the repository root:

```powershell
docker compose -f docker-compose.test.yml down
```

# 4. Database

The schema is `apps/backend/prisma/schema.prisma` (Prisma 7) and the migrations are in `apps/backend/prisma/migrations/`.

## Changing the schema

1. Edit `schema.prisma`.
2. Generate the SQL against your database:

   ```bash
   cd apps/backend
   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma \
     --script -o prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql
   ```

3. Review the SQL, then apply it and regenerate the client:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

Avoid `prisma migrate dev` on a database other people use: when it finds a drift it asks to reset it. Test risky migrations on a throwaway database first.

The CI applies every migration to an empty PostgreSQL 17 and fails if the result differs from `schema.prisma`.

## Seed

`npx prisma db seed` creates the `admin` / `admin` user for development. On a VM the installer creates the admin with the password chosen during the install.

The system catalogues (taxes, platforms, company modules) are not in the seed: they are in `src/catalog-seed/data/systemCatalog.ts` and are applied when the backend starts.

## ClickHouse

The candles are outside Prisma. Their tables are in `apps/downloader/clickhouse/migrations/` and `apps/simulator/clickhouse/migrations/`; each Python app applies its own when it starts and records them in `schema_migrations`.

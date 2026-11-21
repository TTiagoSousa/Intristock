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

### Destructive migrations

When an update fails after its migrations started, `update.sh` restores the database dump taken right before them and puts the previous code back. So:

- Anything written between the migrations and the rollback is lost, and the previous version's code must work against the schema it had.
- Prefer additive migrations (new tables, nullable columns, new indexes). Drop a column or table in a later release than the one that stopped using it.
- Data rewrites (`UPDATE` in a migration) must be safe to run once and must not depend on code from the same release.
- ClickHouse tables are not rolled back.

## Seed

`npx prisma db seed` creates the `admin` / `admin` user for development. On a VM the installer creates the admin with the password chosen during the install, or a random one it prints once.

The system catalogues (taxes, platforms, company modules) are not in the seed: they are in `src/catalog-seed/data/systemCatalog.ts` and are applied when the backend starts.

## ClickHouse

The candles are outside Prisma. Their tables are in `apps/downloader/clickhouse/migrations/` and `apps/simulator/clickhouse/migrations/`; each Python app applies its own when it starts and records them in `schema_migrations`.

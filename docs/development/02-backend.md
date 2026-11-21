# 2. Backend

`apps/backend` is a NestJS 11 app. Each feature is a module in `src/<module>`:

```
src/personal-portfolio/
  personal-portfolio.controller.ts   routes, DTO validation, guards
  personal-portfolio.service.ts      wires the helpers to the repositories
  personal-portfolio.module.ts
  dto/                               request bodies and queries (class-validator)
  helpers/                           the logic, one exported function per file
  repositories/prisma/               the only place that uses Prisma
```

## Layers

`controller → service → helper → repository`. A controller never talks to Prisma, and a helper receives the repositories it needs as arguments, so the logic stays in small functions that are easy to read.

## Access

- `JwtUserAuthGuard` on every route that needs a session; `UserAdminGuard` on admin routes.
- Personal routes filter by the user id from the session: a user only ever sees their own records.
- Company routes call `assertCompanyAccess(userId, companyId, companyRepository, { permission })`. The permission is one from `COMPANY_PERMISSION_AREAS` (`company/permissions/companyPermissions.ts`), a list (any of them is enough) or `member` / `owner`. Write permissions are refused on a deactivated company.
- A new company area adds its permissions to that list and the translations under `companyRoles.areas` / `actions`.

## Adding a route

1. Add the DTO in `dto/` with its validators.
2. Write the helper in `helpers/<name>.ts`.
3. Add the repository methods it needs.
4. Call the helper from the service and expose it in the controller, with the guard and the access check.
5. Add the route to [docs/api.md](../api.md); `node scripts/check-api-docs.mjs` (and the CI) fails if a mounted route is missing or a documented one does not exist.

Fixed routes (`@Get('catalog')`) go before parameter routes (`@Get(':slug')`) in the controller, or Nest matches the parameter first.

## Background services

Timers run as Nest services that start with the module. Periodic jobs use `startScheduledJob` (`src/common/scheduledJob.ts`): it keeps the last run in `AppSetting` (`jobs.<name>.lastRunAt`), so a restart does not rerun a job whose interval has not passed, and each job has its own first delay (`staggerMs`). They log and retry on the next round instead of failing the app. The full list, with intervals and API limits, is in [architecture](../architecture.md#scheduled-jobs); a new job goes there too.

## Cross-cutting rules

- `main.ts` sets helmet, the CSRF middleware (writes need a JSON or multipart body; multipart and body-less writes need `X-Requested-With`), the global `PrismaExceptionFilter` (P2002/P2003 → 409, P2025 → 404) and the production secrets check.
- Rate limits are per route: `LoginThrottlerGuard` on the login and `@UserThrottle(...)` (per user) on routes that call paid or shared APIs (`src/common/throttle`). There is no global throttler guard.
- Writes that must not run twice (paying a salary period, settling or paying out hours, a product name) take a PostgreSQL advisory lock inside the transaction (`pg_advisory_xact_lock`).
- Secrets are stored with `encryptSecret(value, secretContext(table, owner, field))` and read with the same context.
- Fixed rules live in small pure helpers with a `*.spec.ts` next to them; `npm test` runs them.

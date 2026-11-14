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
5. Add the route to [docs/api.md](../api.md).

Fixed routes (`@Get('catalog')`) go before parameter routes (`@Get(':slug')`) in the controller, or Nest matches the parameter first.

## Background services

Timers run as Nest services that start with the module (`OnModuleInit`): the market sync (`market-data`), the prop firm sync, the hourly exchange rates and the version watcher. They log and retry on the next round instead of failing the app.

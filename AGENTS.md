# School Accounting System

## Stack
- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL with Prisma (multiSchema preview)
- **Auth:** iron-session (cookie-based, not JWT)
- **UI:** Tailwind CSS, Radix UI primitives, Lucide icons
- **Validation:** Zod

## Key Architecture
- **Multi-tenant via PostgreSQL schemas:** Each entity/branch gets its own schema (e.g. `entity_main`) with all accounting tables. The `public` schema stores shared data (users, roles, entities).
- **Session:** `getSession()` from `@/lib/auth/session` returns an `IronSession` with `userId`, `entityId`, `roleName`, etc. Session is cookie-based via `iron-session`.
- **Permissions:** `hasPermission(roleName, resource, action)` from `@/lib/auth/rbac`.
- **Database queries for entity data:** Use `prisma.$queryRawUnsafe()` with the entity's `schemaName` for SQL queries. Never use Prisma models for entity-scoped tables (they live in dynamic schemas).
- **Next.js route groups:** `(dashboard)` is a route group — produces no URL segment. All routes are `/`, `/accounts`, etc. (no `/dashboard` prefix).

## Entity Selection Flow
1. Login sets `session.entityId` from `user.entityId` in DB
2. If `user.entityId` is null, login redirects to `/select-entity` (QuickBooks-style entity picker)
3. Entity selection page calls `POST /api/v1/auth/select-entity` to set `session.entityId`
4. After selection, redirects to `/` (dashboard)
5. Sidebar has an `EntitySelector` dropdown that calls `PATCH /api/v1/auth/entity` to switch entities
6. Pages check `if (!session.entityId)` and show "Please select an entity."

## Entity Creation Flow
- The Branches page (`/entities`) lets admins create entities
- `entity.service.create()` calls `createEntitySchema()` which creates the PostgreSQL schema + all accounting tables + default accounts via `prisma.$executeRawUnsafe()`
- Must use a `for` loop over individual SQL statements (not `$transaction`) for DDL

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Build for production
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint
- `npm run test` — Vitest
- `npm run test:run` — Vitest single run
- `npm run db:seed` — Seed database (creates roles, permissions, entities, admin user)
- `npm run db:generate` — Prisma generate
- `npm run db:push` — Prisma db push
- `npm run db:migrate` — Prisma migrate dev

## Key Files
- `src/lib/auth/session.ts` — Session management
- `src/lib/entity-schema.ts` — Dynamic schema creation for new entities
- `src/services/entity.service.ts` — Entity CRUD service
- `src/components/dashboard/entity-selector.tsx` — Entity dropdown in sidebar
- `src/app/(auth)/select-entity/page.tsx` — Entity selection page (post-login)
- `src/app/api/v1/auth/select-entity/route.ts` — API to set session entityId

## Known Fixes
1. **"Please select an entity" on every page** — Added entity selector dropdown in sidebar + `PATCH /api/v1/auth/entity` API route so users can select their entity. Also added `/select-entity` page for users without a default entity.
2. **`cannot insert multiple commands into a prepared statement`** — `createEntitySchema()` sends multi-statement SQL. Fix: split by `;` and execute each statement individually in a `for` loop (not `$transaction`).
3. **`relation "entity_main.account" does not exist`** — Seed script created entity record but didn't call `createEntitySchema()`. Fix: added `createEntitySchema("entity_main")` after entity upsert in seed.
4. **404 on all sidebar links** — Sidebar was linking to `/dashboard/...` but Next.js route groups `(dashboard)` produce no URL segment. Fix: all links use `/`, `/accounts`, etc. (no `/dashboard` prefix).
5. **`fiscalPeriodId` null check** — Posting engine assumed `fiscalPeriodId` was always present. Fix: added null check in `posting-engine.ts:103`.

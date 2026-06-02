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
6. **`column "..." does not exist` after pulling new code** — When new columns are added to the migration block in `entity-schema.ts`, existing entity schemas don't auto-update. Fix: run `npm run db:migrate-entities` to apply all pending idempotent migrations to every entity. (See `migrateEntitySchema()` in `src/lib/entity-schema.ts`.)
7. **"Failed to create invoice" / `function lpad(integer, integer, unknown) does not exist`** — `LPAD(MAX(...)+1, 6, '0')` errors because `MAX(...)+1` is an integer. PostgreSQL's `lpad` requires text. Fix: `LPAD((...+1)::text, 6, '0')`. Pattern to copy from: `cash-receipts.service.ts:63` (`LPAD(CAST(next_number AS TEXT), 6, '0')`). Fixed in `student-account.service.ts:96`. Still broken in `cash-disbursements.service.ts:50` (same one-line fix needed).
8. **`column "..." is of type uuid but expression is of type text` / `operator does not exist: uuid = text` (codes 42804 / 42883)** — Raw SQL writes `WHERE id = $1` or `INSERT ... VALUES ($1, ...)` on UUID columns without casts. Fix: append `::uuid` to every UUID parameter (e.g. `WHERE id = $1::uuid`, `VALUES ($1::uuid, $2::uuid, $3)`). Date params need `::date`. The pattern is correct in `student-account.service.ts:34, 68` but missing in `journal-entry.repository.create`, `posting-engine.validate/post/reverse`, `ledger.repository.updateRunningBalance`, `billing-engine` `UPDATE student_invoice`, and `student-account.service.createInvoice`. Affects 12+ callers of `journalEntryRepository.create`.
9. **JE line → subledger party tagging** — `account.subledger_type` (`'student'|'vendor'|'employee'|NULL`) is the chart-of-accounts hint that drives the per-line party picker on `/journal-entries/new`. JE lines for subledger accounts require `party_type` + `party_id` matching the account's subledger type (or both NULL for non-subledger accounts). Chart defaults seeded for 11210-11214 (student), 11250/11260/21210 (employee), 21110-21140 (vendor). The apply flow on posted JEs (`/journal-entries/[id]/lines/[lineId]/apply`) reduces the subledger document's balance; the JE itself is not modified. Employee AP apply is a stub (picker works, button hidden). **Trap:** when adding SQL to `migrateEntitySchema`'s `migrations` literal, do not put `;` inside `--` comments — the `for (const stmt of migrations.split(";"))` loop breaks on the first `;` in a comment.

# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the project with Next.js, Prisma, Docker, Auth, Multi-Entity, and Chart of Accounts — the foundation everything else depends on.

**Architecture:** Modular monolith with Next.js App Router (API + pages), Prisma ORM on PostgreSQL with schema-per-entity multi-tenancy, session-based auth with RBAC.

**Tech Stack:** Next.js 14+, TypeScript 5+, TailwindCSS, shadcn/ui, Prisma, PostgreSQL 16, Redis 7, Zod, bcrypt, iron-session, Docker Compose, Nginx

---

### Task 1: Project Scaffolding

**Files:**
- Create: `D:\school-accounting\package.json`
- Create: `D:\school-accounting\tsconfig.json`
- Create: `D:\school-accounting\.env.example`
- Create: `D:\school-accounting\.gitignore`
- Create: `D:\school-accounting\postcss.config.js`
- Create: `D:\school-accounting\tailwind.config.ts`
- Create: `D:\school-accounting\components.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "school-accounting",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx scripts/seed.ts",
    "db:studio": "prisma studio",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@prisma/client": "^5.14.0",
    "iron-session": "^8.0.0",
    "bcryptjs": "^2.4.3",
    "zod": "^3.23.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.378.0",
    "@tanstack/react-query": "^5.40.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-toast": "^1.1.5"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.12.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/bcryptjs": "^2.4.6",
    "prisma": "^5.14.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "tsx": "^4.11.0",
    "vitest": "^1.6.0",
    "@vitejs/plugin-react": "^4.3.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create .env.example**

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/school_accounting?schema=public"
REDIS_URL="redis://localhost:6379"
SESSION_SECRET="change-me-to-a-random-32-char-string-at-least"
NEXT_PUBLIC_APP_NAME="School Accounting System"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
.next/
.env
.env.local
*.log
prisma/migrations/
uploads/
```

- [ ] **Step 5: Create postcss.config.js**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: Create tailwind.config.ts**

```ts
import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
export default config
```

- [ ] **Step 7: Create components.json (shadcn)**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 8: Run npm install**

Run: `npm install`
Expected: node_modules/ created, package-lock.json created

- [ ] **Step 9: Commit**

```bash
git init
git add package.json tsconfig.json .env.example .gitignore postcss.config.js tailwind.config.ts components.json
git commit -m "chore: scaffold Next.js project"
```

---

### Task 2: Prisma Schema — Public Schema (Users, Roles, Entities)

**Files:**
- Create: `D:\school-accounting\prisma\schema.prisma`
- Modify: `D:\school-accounting\src\lib\db.ts` (create)

- [ ] **Step 1: Create prisma/schema.prisma**

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["public", "audit"]
}

// === PUBLIC SCHEMA (cross-cutting) ===

model Entity {
  id               String   @id @default(uuid()) @db.Uuid
  code             String   @unique @db.VarChar(20)
  name             String   @db.VarChar(200)
  tin              String?  @db.VarChar(20)
  address          String?  @db.Text
  fiscalYearStart  DateTime @map("fiscal_year_start") @db.Date
  status           String   @default("active") @db.VarChar(20)
  schemaName       String   @unique @map("schema_name") @db.VarChar(63)
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  fiscalYears FiscalYear[]
  users       User[]

  @@schema("public")
  @@map("entity")
}

model FiscalYear {
  id        String   @id @default(uuid()) @db.Uuid
  entityId  String   @map("entity_id") @db.Uuid
  label     String   @db.VarChar(20)
  startDate DateTime @map("start_date") @db.Date
  endDate   DateTime @map("end_date") @db.Date
  isClosed  Boolean  @default(false) @map("is_closed")

  entity  Entity        @relation(fields: [entityId], references: [id])
  periods FiscalPeriod[]

  @@unique([entityId, label])
  @@schema("public")
  @@map("fiscal_year")
}

model FiscalPeriod {
  id            String   @id @default(uuid()) @db.Uuid
  fiscalYearId  String   @map("fiscal_year_id") @db.Uuid
  periodNumber  Int      @map("period_number")
  startDate     DateTime @map("start_date") @db.Date
  endDate       DateTime @map("end_date") @db.Date
  isClosed      Boolean  @default(false) @map("is_closed")

  fiscalYear FiscalYear @relation(fields: [fiscalYearId], references: [id])

  @@unique([fiscalYearId, periodNumber])
  @@schema("public")
  @@map("fiscal_period")
}

model Role {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @unique @db.VarChar(50)
  description String?  @db.Text
  isSystem    Boolean  @default(false) @map("is_system")
  createdAt   DateTime @default(now()) @map("created_at")

  permissions RolePermission[]
  users       User[]

  @@schema("public")
  @@map("role")
}

model Permission {
  id       String @id @default(uuid()) @db.Uuid
  resource String @db.VarChar(50)
  action   String @db.VarChar(20)

  roles RolePermission[]

  @@unique([resource, action])
  @@schema("public")
  @@map("permission")
}

model RolePermission {
  roleId       String @map("role_id") @db.Uuid
  permissionId String @map("permission_id") @db.Uuid

  role       Role       @relation(fields: [roleId], references: [id])
  permission Permission @relation(fields: [permissionId], references: [id])

  @@id([roleId, permissionId])
  @@schema("public")
  @@map("role_permission")
}

model User {
  id           String    @id @default(uuid()) @db.Uuid
  email        String    @unique @db.VarChar(200)
  passwordHash String    @map("password_hash") @db.VarChar(255)
  fullName     String    @map("full_name") @db.VarChar(200)
  roleId       String    @map("role_id") @db.Uuid
  entityId     String?   @map("entity_id") @db.Uuid
  isActive     Boolean   @default(true) @map("is_active")
  lastLogin    DateTime? @map("last_login")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  role   Role    @relation(fields: [roleId], references: [id])
  entity Entity? @relation(fields: [entityId], references: [id])

  @@schema("public")
  @@map("user_account")
}

// === AUDIT SCHEMA ===

model AuditLog {
  id        String   @id @default(uuid()) @db.Uuid
  entityId  String   @map("entity_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  action    String   @db.VarChar(20)
  tableName String   @map("table_name") @db.VarChar(63)
  recordId  String   @map("record_id") @db.Uuid
  oldValues String?  @map("old_values") @db.JsonB
  newValues String?  @map("new_values") @db.JsonB
  ipAddress String?  @map("ip_address") @db.Inet
  userAgent String?  @map("user_agent") @db.Text
  createdAt DateTime @default(now()) @map("created_at")

  @@schema("audit")
  @@map("audit_log")
}
```

- [ ] **Step 2: Create src/lib/db.ts**

```ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

- [ ] **Step 3: Generate Prisma client**

Run: `npx prisma generate`
Expected: Prisma Client generated

- [ ] **Step 4: Push schema to database**

Run: `npx prisma db push`
Expected: Database tables created

- [ ] **Step 5: Commit**

```bash
git add prisma/ src/lib/db.ts
git commit -m "feat: add Prisma schema with public and audit schemas"
```

---

### Task 3: Auth Infrastructure — Session Management & RBAC

**Files:**
- Create: `D:\school-accounting\src\lib\auth\session.ts`
- Create: `D:\school-accounting\src\lib\auth\rbac.ts`
- Create: `D:\school-accounting\src\types\api.ts`

- [ ] **Step 1: Create src/lib/auth/session.ts**

```ts
import { getIronSession, IronSession } from "iron-session"
import { cookies } from "next/headers"

export interface SessionData {
  userId: string
  email: string
  fullName: string
  roleId: string
  roleName: string
  entityId?: string
  isActive: boolean
}

const sessionOptions = {
  password: process.env.SESSION_SECRET || "change-me-to-a-random-32-char-string-at-least",
  cookieName: "school_acct_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 8, // 8 hours
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  return session
}

export async function destroySession(): Promise<void> {
  const session = await getSession()
  session.destroy()
}
```

- [ ] **Step 2: Create src/lib/auth/rbac.ts**

```ts
export type Resource =
  | "accounts"
  | "journal_entries"
  | "official_receipts"
  | "cash_receipts"
  | "cash_disbursements"
  | "student_accounts"
  | "vendor_accounts"
  | "fixed_assets"
  | "bank_reconciliation"
  | "reports"
  | "users"
  | "entities"
  | "audit_log"
  | "fiscal_periods"

export type Action = "create" | "read" | "update" | "delete" | "post" | "approve" | "export"

const rolePermissions: Record<string, { resource: Resource; action: Action }[]> = {
  super_admin: [
    { resource: "accounts", action: "create" },
    { resource: "accounts", action: "read" },
    { resource: "accounts", action: "update" },
    { resource: "accounts", action: "delete" },
    { resource: "journal_entries", action: "create" },
    { resource: "journal_entries", action: "read" },
    { resource: "journal_entries", action: "update" },
    { resource: "journal_entries", action: "post" },
    { resource: "journal_entries", action: "approve" },
    { resource: "reports", action: "read" },
    { resource: "reports", action: "export" },
    { resource: "users", action: "create" },
    { resource: "users", action: "read" },
    { resource: "users", action: "update" },
    { resource: "users", action: "delete" },
    { resource: "entities", action: "create" },
    { resource: "entities", action: "read" },
    { resource: "entities", action: "update" },
    { resource: "entities", action: "delete" },
    { resource: "audit_log", action: "read" },
    { resource: "fiscal_periods", action: "create" },
    { resource: "fiscal_periods", action: "update" },
  ],
  accountant: [
    { resource: "accounts", action: "create" },
    { resource: "accounts", action: "read" },
    { resource: "accounts", action: "update" },
    { resource: "journal_entries", action: "create" },
    { resource: "journal_entries", action: "read" },
    { resource: "journal_entries", action: "post" },
    { resource: "journal_entries", action: "approve" },
    { resource: "reports", action: "read" },
    { resource: "reports", action: "export" },
  ],
  finance_officer: [
    { resource: "accounts", action: "read" },
    { resource: "cash_receipts", action: "create" },
    { resource: "cash_receipts", action: "read" },
    { resource: "cash_disbursements", action: "create" },
    { resource: "cash_disbursements", action: "read" },
    { resource: "student_accounts", action: "read" },
    { resource: "vendor_accounts", action: "read" },
    { resource: "reports", action: "read" },
  ],
  auditor: [
    { resource: "accounts", action: "read" },
    { resource: "journal_entries", action: "read" },
    { resource: "cash_receipts", action: "read" },
    { resource: "cash_disbursements", action: "read" },
    { resource: "student_accounts", action: "read" },
    { resource: "vendor_accounts", action: "read" },
    { resource: "reports", action: "read" },
    { resource: "reports", action: "export" },
    { resource: "audit_log", action: "read" },
  ],
  cashier: [
    { resource: "cash_receipts", action: "create" },
    { resource: "cash_receipts", action: "read" },
    { resource: "official_receipts", action: "create" },
    { resource: "official_receipts", action: "read" },
    { resource: "student_accounts", action: "read" },
    { resource: "reports", action: "read" },
  ],
}

export function hasPermission(
  roleName: string,
  resource: Resource,
  action: Action
): boolean {
  const permissions = rolePermissions[roleName]
  if (!permissions) return false
  return permissions.some((p) => p.resource === resource && p.action === action)
}

export function getPermissionsForRole(roleName: string): { resource: Resource; action: Action }[] {
  return rolePermissions[roleName] || []
}
```

- [ ] **Step 3: Create src/types/api.ts**

```ts
export interface ApiResponse<T = unknown> {
  success: boolean
  data: T | null
  meta?: {
    page: number
    pageSize: number
    total: number
  }
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

export interface PaginationParams {
  page?: number
  pageSize?: number
}

export interface ErrorCode {
  code: string
  message: string
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/ src/types/
git commit -m "feat: add session management and RBAC"
```

---

### Task 4: Auth Middleware & Login API

**Files:**
- Create: `D:\school-accounting\src\middleware.ts`
- Create: `D:\school-accounting\src\app\api\v1\auth\login\route.ts`
- Create: `D:\school-accounting\src\app\api\v1\auth\me\route.ts`
- Create: `D:\school-accounting\src\app\api\v1\auth\logout\route.ts`
- Create: `D:\school-accounting\src\lib\validators\auth.ts`
- Create: `D:\school-accounting\src\lib\utils.ts`

- [ ] **Step 1: Create src/lib/utils.ts**

```ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatApiResponse<T>(
  data: T | null,
  meta?: { page: number; pageSize: number; total: number }
) {
  return { success: true, data, meta, error: null }
}

export function formatApiError(code: string, message: string, details?: unknown) {
  return { success: false, data: null, error: { code, message, details } }
}
```

- [ ] **Step 2: Create src/lib/validators/auth.ts**

```ts
import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export type LoginInput = z.infer<typeof loginSchema>
```

- [ ] **Step 3: Create src/app/api/v1/auth/login/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/auth/session"
import { loginSchema } from "@/lib/validators/auth"
import { formatApiError } from "@/lib/utils"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        formatApiError("ERR_VALIDATION", parsed.error.message),
        { status: 400 }
      )
    }

    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        formatApiError("ERR_INVALID_CREDENTIALS", "Invalid email or password"),
        { status: 401 }
      )
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash)
    if (!passwordValid) {
      return NextResponse.json(
        formatApiError("ERR_INVALID_CREDENTIALS", "Invalid email or password"),
        { status: 401 }
      )
    }

    const session = await getSession()
    session.userId = user.id
    session.email = user.email
    session.fullName = user.fullName
    session.roleId = user.roleId
    session.roleName = user.role.name
    session.entityId = user.entityId ?? undefined
    session.isActive = user.isActive
    await session.save()

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.name,
        entityId: user.entityId,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      formatApiError("ERR_INTERNAL", "An unexpected error occurred"),
      { status: 500 }
    )
  }
}
```

- [ ] **Step 4: Create src/app/api/v1/auth/me/route.ts**

```ts
import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { formatApiError } from "@/lib/utils"

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(
        formatApiError("ERR_UNAUTHORIZED", "Not authenticated"),
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: session.userId,
        email: session.email,
        fullName: session.fullName,
        roleName: session.roleName,
        entityId: session.entityId,
      },
    })
  } catch (error) {
    console.error("Session error:", error)
    return NextResponse.json(
      formatApiError("ERR_INTERNAL", "An unexpected error occurred"),
      { status: 500 }
    )
  }
}
```

- [ ] **Step 5: Create src/app/api/v1/auth/logout/route.ts**

```ts
import { NextResponse } from "next/server"
import { destroySession } from "@/lib/auth/session"

export async function POST() {
  await destroySession()
  return NextResponse.json({ success: true, data: null })
}
```

- [ ] **Step 6: Create src/middleware.ts**

```ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const publicPaths = ["/api/v1/auth/login"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api/") || pathname.startsWith("/dashboard")) {
    const sessionCookie = request.cookies.get("school_acct_session")
    if (!sessionCookie) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, data: null, error: { code: "ERR_UNAUTHORIZED", message: "Not authenticated" } },
          { status: 401 }
        )
      }
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"],
}
```

- [ ] **Step 7: Commit**

```bash
git add src/middleware.ts src/app/api/v1/auth/ src/lib/validators/auth.ts src/lib/utils.ts
git commit -m "feat: add auth API endpoints and middleware"
```

---

### Task 5: Entity Management (Multi-Tenant) API

**Files:**
- Create: `D:\school-accounting\src\lib\validators\entity.ts`
- Create: `D:\school-accounting\src\repositories\entity.repository.ts`
- Create: `D:\school-accounting\src\services\entity.service.ts`
- Create: `D:\school-accounting\src\app\api\v1\entities\route.ts`
- Create: `D:\school-accounting\src\app\api\v1\entities\[id]\route.ts`

- [ ] **Step 1: Create src/lib/validators/entity.ts**

```ts
import { z } from "zod"

export const createEntitySchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(200),
  tin: z.string().max(20).optional(),
  address: z.string().optional(),
  fiscalYearStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date (YYYY-MM-DD)"),
})

export const updateEntitySchema = z.object({
  name: z.string().min(2).max(200).optional(),
  tin: z.string().max(20).optional(),
  address: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
})

export type CreateEntityInput = z.infer<typeof createEntitySchema>
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>
```

- [ ] **Step 2: Create src/repositories/entity.repository.ts**

```ts
import { prisma } from "@/lib/db"

export const entityRepository = {
  async findAll() {
    return prisma.entity.findMany({ orderBy: { name: "asc" } })
  },

  async findById(id: string) {
    return prisma.entity.findUnique({ where: { id } })
  },

  async findByCode(code: string) {
    return prisma.entity.findUnique({ where: { code } })
  },

  async create(data: {
    code: string
    name: string
    tin?: string
    address?: string
    fiscalYearStart: Date
    schemaName: string
  }) {
    return prisma.entity.create({ data })
  },

  async update(id: string, data: { name?: string; tin?: string; address?: string; status?: string }) {
    return prisma.entity.update({ where: { id }, data })
  },

  async delete(id: string) {
    return prisma.entity.update({ where: { id }, data: { status: "inactive" } })
  },
}
```

- [ ] **Step 3: Create src/services/entity.service.ts**

```ts
import { entityRepository } from "@/repositories/entity.repository"
import type { CreateEntityInput, UpdateEntityInput } from "@/lib/validators/entity"

function generateSchemaName(code: string): string {
  return `entity_${code.toLowerCase().replace(/[^a-z0-9]/g, "_")}`
}

export const entityService = {
  async list() {
    return entityRepository.findAll()
  },

  async getById(id: string) {
    return entityRepository.findById(id)
  },

  async create(input: CreateEntityInput) {
    const existing = await entityRepository.findByCode(input.code)
    if (existing) {
      throw new Error("Entity code already exists")
    }

    const schemaName = generateSchemaName(input.code)

    return entityRepository.create({
      code: input.code,
      name: input.name,
      tin: input.tin,
      address: input.address,
      fiscalYearStart: new Date(input.fiscalYearStart),
      schemaName,
    })
  },

  async update(id: string, input: UpdateEntityInput) {
    return entityRepository.update(id, input as Record<string, string>)
  },

  async deactivate(id: string) {
    return entityRepository.delete(id)
  },
}
```

- [ ] **Step 4: Create src/app/api/v1/entities/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { entityService } from "@/services/entity.service"
import { createEntitySchema } from "@/lib/validators/entity"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    const entities = await entityService.list()
    return NextResponse.json(formatApiResponse(entities))
  } catch (error) {
    console.error("List entities error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list entities"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    if (!hasPermission(session.roleName, "entities", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const body = await request.json()
    const parsed = createEntitySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", parsed.error.message), { status: 400 })
    }

    const entity = await entityService.create(parsed.data)
    return NextResponse.json(formatApiResponse(entity), { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create entity"
    return NextResponse.json(formatApiError("ERR_INTERNAL", message), { status: 500 })
  }
}
```

- [ ] **Step 5: Create src/app/api/v1/entities/[id]/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { entityService } from "@/services/entity.service"
import { updateEntitySchema } from "@/lib/validators/entity"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    const entity = await entityService.getById(id)
    if (!entity) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    return NextResponse.json(formatApiResponse(entity))
  } catch (error) {
    console.error("Get entity error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get entity"), { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    if (!hasPermission(session.roleName, "entities", "update")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const body = await request.json()
    const parsed = updateEntitySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", parsed.error.message), { status: 400 })
    }

    const entity = await entityService.update(id, parsed.data)
    return NextResponse.json(formatApiResponse(entity))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update entity"
    return NextResponse.json(formatApiError("ERR_INTERNAL", message), { status: 500 })
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/validators/entity.ts src/repositories/entity.repository.ts src/services/entity.service.ts src/app/api/v1/entities/
git commit -m "feat: add multi-entity management API"
```

---

### Task 6: Chart of Accounts API

**Files:**
- Create: `D:\school-accounting\src\lib\validators\account.ts`
- Create: `D:\school-accounting\src\repositories\account.repository.ts`
- Create: `D:\school-accounting\src\services\account.service.ts`
- Create: `D:\school-accounting\src\app\api\v1\accounts\route.ts`
- Create: `D:\school-accounting\src\app\api\v1\accounts\[id]\route.ts`

- [ ] **Step 1: Create src/lib/validators/account.ts**

```ts
import { z } from "zod"

const accountTypes = [
  "asset", "liability", "equity", "revenue", "expense",
  "contra_asset", "contra_revenue", "contra_liability",
] as const

const normalBalances = ["debit", "credit"] as const

export const createAccountSchema = z.object({
  accountCode: z.string().min(2).max(20),
  accountName: z.string().min(2).max(200),
  accountType: z.enum(accountTypes),
  normalBalance: z.enum(normalBalances),
  parentId: z.string().uuid().optional(),
  level: z.number().int().min(0).max(3).default(3),
  description: z.string().optional(),
})

export const updateAccountSchema = z.object({
  accountName: z.string().min(2).max(200).optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
})

export type CreateAccountInput = z.infer<typeof createAccountSchema>
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>
```

- [ ] **Step 2: Create src/repositories/account.repository.ts**

```ts
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"

export const accountRepository = {
  async findAll(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}"."account" ORDER BY account_code`
    )
  },

  async findById(entitySchema: string, id: string) {
    const results = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}"."account" WHERE id = $1`,
      id
    )
    return results[0] || null
  },

  async findByCode(entitySchema: string, code: string) {
    const results = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}"."account" WHERE account_code = $1`,
      code
    )
    return results[0] || null
  },

  async findChildren(entitySchema: string, parentId: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}"."account" WHERE parent_id = $1 ORDER BY account_code`,
      parentId
    )
  },

  async create(
    entitySchema: string,
    data: {
      accountCode: string
      accountName: string
      accountType: string
      normalBalance: string
      parentId?: string
      level: number
      description?: string
    }
  ) {
    const results = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}"."account" (account_code, account_name, account_type, normal_balance, parent_id, level, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      data.accountCode, data.accountName, data.accountType, data.normalBalance,
      data.parentId || null, data.level, data.description || null
    )
    return results[0]
  },

  async update(entitySchema: string, id: string, data: { accountName?: string; isActive?: boolean; description?: string }) {
    const sets: string[] = []
    const values: any[] = []
    let idx = 1

    if (data.accountName !== undefined) { sets.push(`account_name = $${idx++}`); values.push(data.accountName) }
    if (data.isActive !== undefined) { sets.push(`is_active = $${idx++}`); values.push(data.isActive) }
    if (data.description !== undefined) { sets.push(`description = $${idx++}`); values.push(data.description) }

    if (sets.length === 0) {
      const results = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${entitySchema}"."account" WHERE id = $1`, id
      )
      return results[0]
    }

    values.push(id)
    const results = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE "${entitySchema}"."account" SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      ...values
    )
    return results[0]
  },
}
```

- [ ] **Step 3: Create src/services/account.service.ts**

```ts
import { accountRepository } from "@/repositories/account.repository"
import type { CreateAccountInput, UpdateAccountInput } from "@/lib/validators/account"

export const accountService = {
  async list(entitySchema: string) {
    return accountRepository.findAll(entitySchema)
  },

  async getById(entitySchema: string, id: string) {
    return accountRepository.findById(entitySchema, id)
  },

  async getTree(entitySchema: string) {
    const accounts = await accountRepository.findAll(entitySchema)
    return buildTree(accounts)
  },

  async create(entitySchema: string, input: CreateAccountInput) {
    const existing = await accountRepository.findByCode(entitySchema, input.accountCode)
    if (existing) {
      throw new Error("Account code already exists")
    }
    return accountRepository.create(entitySchema, input)
  },

  async update(entitySchema: string, id: string, input: UpdateAccountInput) {
    return accountRepository.update(entitySchema, id, input)
  },
}

function buildTree(accounts: any[]): any[] {
  const map = new Map<string, any>()
  const roots: any[] = []

  accounts.forEach((acc) => {
    map.set(acc.id, { ...acc, children: [] })
  })

  accounts.forEach((acc) => {
    const node = map.get(acc.id)
    if (acc.parent_id && map.has(acc.parent_id)) {
      map.get(acc.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}
```

- [ ] **Step 4: Create src/app/api/v1/accounts/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { accountService } from "@/services/account.service"
import { createAccountSchema } from "@/lib/validators/account"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"

async function getEntitySchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const { prisma } = await import("@/lib/db")
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    if (!hasPermission(session.roleName, "accounts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const tree = request.nextUrl.searchParams.get("tree") === "true"
    const accounts = tree ? await accountService.getTree(schema) : await accountService.list(schema)
    return NextResponse.json(formatApiResponse(accounts))
  } catch (error) {
    console.error("List accounts error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list accounts"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    if (!hasPermission(session.roleName, "accounts", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const body = await request.json()
    const parsed = createAccountSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", parsed.error.message), { status: 400 })
    }

    const account = await accountService.create(schema, parsed.data)
    return NextResponse.json(formatApiResponse(account), { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create account"
    return NextResponse.json(formatApiError("ERR_INTERNAL", message), { status: 500 })
  }
}
```

- [ ] **Step 5: Create src/app/api/v1/accounts/[id]/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { accountService } from "@/services/account.service"
import { updateAccountSchema } from "@/lib/validators/account"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"
import { prisma } from "@/lib/db"

async function getEntitySchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    if (!hasPermission(session.roleName, "accounts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const account = await accountService.getById(schema, id)
    if (!account) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Account not found"), { status: 404 })
    }

    return NextResponse.json(formatApiResponse(account))
  } catch (error) {
    console.error("Get account error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get account"), { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    if (!hasPermission(session.roleName, "accounts", "update")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const body = await request.json()
    const parsed = updateAccountSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", parsed.error.message), { status: 400 })
    }

    const account = await accountService.update(schema, id, parsed.data)
    return NextResponse.json(formatApiResponse(account))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update account"
    return NextResponse.json(formatApiError("ERR_INTERNAL", message), { status: 500 })
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/validators/account.ts src/repositories/account.repository.ts src/services/account.service.ts src/app/api/v1/accounts/
git commit -m "feat: add chart of accounts API with tree view"
```

---

### Task 7: Per-Entity Schema Creation

**Files:**
- Create: `D:\school-accounting\src\lib\entity-schema.ts`

- [ ] **Step 1: Create src/lib/entity-schema.ts**

```ts
import { prisma } from "@/lib/db"

export async function createEntitySchema(schemaName: string): Promise<void> {
  const sql = `
    CREATE SCHEMA IF NOT EXISTS "${schemaName}";

    CREATE TABLE IF NOT EXISTS "${schemaName}".account (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_code VARCHAR(20) NOT NULL UNIQUE,
      account_name VARCHAR(200) NOT NULL,
      account_type VARCHAR(20) NOT NULL CHECK (account_type IN (
        'asset', 'liability', 'equity', 'revenue', 'expense',
        'contra_asset', 'contra_revenue', 'contra_liability'
      )),
      normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
      is_active BOOLEAN DEFAULT TRUE,
      parent_id UUID REFERENCES "${schemaName}".account(id),
      level INT NOT NULL DEFAULT 0,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".journal_entry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_number VARCHAR(30) NOT NULL UNIQUE,
      entry_date DATE NOT NULL,
      reference VARCHAR(50),
      source_module VARCHAR(10) NOT NULL CHECK (source_module IN ('JE','AR','AP','CM','CD','FA','BR')),
      description TEXT,
      status VARCHAR(10) DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
      posted_at TIMESTAMPTZ,
      posted_by UUID,
      approved_by UUID,
      fiscal_period_id UUID,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by UUID,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".journal_entry_line (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      journal_entry_id UUID NOT NULL REFERENCES "${schemaName}".journal_entry(id),
      account_id UUID NOT NULL REFERENCES "${schemaName}".account(id),
      debit DECIMAL(18,2) DEFAULT 0 CHECK (debit >= 0),
      credit DECIMAL(18,2) DEFAULT 0 CHECK (credit >= 0),
      line_description TEXT,
      line_order INT NOT NULL,
      CHECK (debit > 0 OR credit > 0)
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".general_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES "${schemaName}".account(id),
      fiscal_period_id UUID,
      normal_balance VARCHAR(10) NOT NULL,
      beginning_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
      total_debits DECIMAL(18,2) DEFAULT 0,
      total_credits DECIMAL(18,2) DEFAULT 0,
      last_journal_entry_id UUID,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(account_id, fiscal_period_id)
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".number_series (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      series_type VARCHAR(10) NOT NULL CHECK (series_type IN ('JE','OR','CV','CDV','PO','DV')),
      prefix VARCHAR(10) NOT NULL,
      starting_number INT NOT NULL DEFAULT 1,
      next_number INT NOT NULL DEFAULT 1,
      suffix VARCHAR(10),
      fiscal_year_id UUID,
      UNIQUE(series_type, fiscal_year_id)
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".official_receipt (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      or_number VARCHAR(30) NOT NULL UNIQUE,
      or_date DATE NOT NULL,
      cash_receipt_id UUID,
      student_id UUID,
      payor_name VARCHAR(200) NOT NULL,
      payor_address TEXT,
      tin VARCHAR(20),
      amount DECIMAL(18,2) NOT NULL,
      vat_amount DECIMAL(18,2) DEFAULT 0,
      vat_exempt_amount DECIMAL(18,2) DEFAULT 0,
      vat_rate DECIMAL(5,2) DEFAULT 12.00,
      is_zero_rated BOOLEAN DEFAULT FALSE,
      journal_entry_id UUID,
      status VARCHAR(10) DEFAULT 'active' CHECK (status IN ('active', 'void')),
      void_reason TEXT,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      bir_serial_number VARCHAR(50),
      bir_accredited_printer_tin VARCHAR(20),
      bir_permit_number VARCHAR(50)
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".official_receipt_line (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      official_receipt_id UUID NOT NULL REFERENCES "${schemaName}".official_receipt(id),
      description TEXT NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      vat_sales DECIMAL(18,2) DEFAULT 0,
      vat_exempt_sales DECIMAL(18,2) DEFAULT 0,
      zero_rated_sales DECIMAL(18,2) DEFAULT 0,
      vat_amount DECIMAL(18,2) DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".student (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_number VARCHAR(30) NOT NULL UNIQUE,
      full_name VARCHAR(200) NOT NULL,
      course VARCHAR(100),
      grade_level VARCHAR(20),
      status VARCHAR(20) NOT NULL CHECK (status IN ('enrolled','graduated','transferred','withdrawn')),
      contact_info JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".student_invoice (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number VARCHAR(30) NOT NULL UNIQUE,
      student_id UUID NOT NULL REFERENCES "${schemaName}".student(id),
      fiscal_year_id UUID,
      term VARCHAR(50),
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      total_amount DECIMAL(18,2) NOT NULL,
      balance DECIMAL(18,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid','overpaid','cancelled')),
      journal_entry_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".student_invoice_line (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES "${schemaName}".student_invoice(id),
      fee_type VARCHAR(50) NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      discount_type VARCHAR(50),
      discount_amount DECIMAL(18,2) DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".payment_transaction (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_number VARCHAR(30) NOT NULL UNIQUE,
      student_id UUID REFERENCES "${schemaName}".student(id),
      invoice_id UUID REFERENCES "${schemaName}".student_invoice(id),
      payment_date DATE NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash','check','bank_transfer','gcash','paymaya')),
      check_number VARCHAR(50),
      check_date DATE,
      bank_name VARCHAR(100),
      reference VARCHAR(50),
      journal_entry_id UUID,
      official_receipt_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".disbursement (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cv_number VARCHAR(30) NOT NULL UNIQUE,
      cv_date DATE NOT NULL,
      payee_type VARCHAR(10) NOT NULL CHECK (payee_type IN ('vendor','employee','student','other')),
      payee_name VARCHAR(200) NOT NULL,
      payee_address TEXT,
      tin VARCHAR(20),
      amount DECIMAL(18,2) NOT NULL,
      payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('check','cash','bank_transfer')),
      check_number VARCHAR(50),
      check_date DATE,
      bank_account VARCHAR(50),
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','void')),
      journal_entry_id UUID,
      ap_invoice_id UUID,
      withholding_tax_amount DECIMAL(18,2) DEFAULT 0,
      withholding_tax_rate DECIMAL(5,2),
      created_by UUID NOT NULL,
      approved_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".fixed_asset (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      asset_code VARCHAR(30) NOT NULL UNIQUE,
      asset_name VARCHAR(200) NOT NULL,
      asset_category VARCHAR(20) NOT NULL CHECK (asset_category IN ('building','equipment','furniture','vehicle','computer','land','other')),
      acquisition_date DATE NOT NULL,
      acquisition_cost DECIMAL(18,2) NOT NULL,
      estimated_life_years INT NOT NULL,
      salvage_value DECIMAL(18,2) DEFAULT 0,
      depreciation_method VARCHAR(20) DEFAULT 'straight_line' CHECK (depreciation_method IN ('straight_line','declining_balance')),
      accumulated_depreciation DECIMAL(18,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','fully_depreciated','disposed')),
      journal_entry_id UUID,
      disposal_date DATE,
      disposal_amount DECIMAL(18,2),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".depreciation_entry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fixed_asset_id UUID NOT NULL REFERENCES "${schemaName}".fixed_asset(id),
      fiscal_period_id UUID,
      depreciation_amount DECIMAL(18,2) NOT NULL,
      journal_entry_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(fixed_asset_id, fiscal_period_id)
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".bank_account (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_code VARCHAR(20) UNIQUE,
      bank_name VARCHAR(100) NOT NULL,
      account_number VARCHAR(50) NOT NULL,
      account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('checking','savings','time_deposit')),
      currency VARCHAR(3) DEFAULT 'PHP',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".bank_reconciliation (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bank_account_id UUID NOT NULL,
      statement_date DATE NOT NULL,
      statement_ending_balance DECIMAL(18,2) NOT NULL,
      book_ending_balance DECIMAL(18,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
      completed_at TIMESTAMPTZ,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".reconciliation_item (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reconciliation_id UUID NOT NULL,
      type VARCHAR(20) NOT NULL CHECK (type IN ('deposit_in_transit','outstanding_check','bank_error','book_error','bank_charge','interest','nsf')),
      reference VARCHAR(50),
      amount DECIMAL(18,2) NOT NULL,
      is_cleared BOOLEAN DEFAULT FALSE,
      journal_entry_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".approval_rule (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module VARCHAR(10) NOT NULL CHECK (module IN ('JE','CD','AP','AR','FA')),
      min_amount DECIMAL(18,2) DEFAULT 0,
      max_amount DECIMAL(18,2),
      required_approvals INT DEFAULT 1,
      approver_roles JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".approval_request (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      record_type VARCHAR(30) NOT NULL,
      record_id UUID NOT NULL,
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      requested_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".approval_action (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      approval_request_id UUID NOT NULL,
      approver_id UUID NOT NULL,
      action VARCHAR(20) NOT NULL CHECK (action IN ('approved','rejected')),
      comments TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Seed default chart of accounts
    INSERT INTO "${schemaName}".account (account_code, account_name, account_type, normal_balance, level) VALUES
      ('10000', 'ASSETS', 'asset', 'debit', 0),
      ('11000', 'Current Assets', 'asset', 'debit', 1),
      ('11100', 'Cash and Cash Equivalents', 'asset', 'debit', 2),
      ('11110', 'Cash on Hand', 'asset', 'debit', 3),
      ('11120', 'Cash in Bank', 'asset', 'debit', 3),
      ('11200', 'Accounts Receivable', 'asset', 'debit', 2),
      ('11210', 'Accounts Receivable - Students', 'asset', 'debit', 3),
      ('11300', 'Allowance for Doubtful Accounts', 'contra_asset', 'credit', 3),
      ('12000', 'Non-Current Assets', 'asset', 'debit', 1),
      ('12100', 'Property, Plant, and Equipment', 'asset', 'debit', 2),
      ('12110', 'Land', 'asset', 'debit', 3),
      ('12120', 'Buildings', 'asset', 'debit', 3),
      ('12130', 'Accumulated Depreciation - Buildings', 'contra_asset', 'credit', 3),
      ('12140', 'Office Equipment', 'asset', 'debit', 3),
      ('12150', 'Accumulated Depreciation - Equipment', 'contra_asset', 'credit', 3),
      ('20000', 'LIABILITIES', 'liability', 'credit', 0),
      ('21000', 'Current Liabilities', 'liability', 'credit', 1),
      ('21100', 'Accounts Payable', 'liability', 'credit', 2),
      ('21110', 'Accounts Payable - Trade', 'liability', 'credit', 3),
      ('21200', 'Accrued Expenses', 'liability', 'credit', 3),
      ('21300', 'Unearned Tuition', 'liability', 'credit', 3),
      ('21400', 'VAT Payable', 'liability', 'credit', 3),
      ('21500', 'Withholding Tax Payable', 'liability', 'credit', 3),
      ('22000', 'Non-Current Liabilities', 'liability', 'credit', 1),
      ('22100', 'Loans Payable', 'liability', 'credit', 3),
      ('30000', 'EQUITY', 'equity', 'credit', 0),
      ('31100', 'Capital', 'equity', 'credit', 3),
      ('31200', 'Retained Earnings', 'equity', 'credit', 3),
      ('39000', 'Income Summary', 'equity', 'credit', 3),
      ('40000', 'REVENUE', 'revenue', 'credit', 0),
      ('41100', 'Tuition Revenue', 'revenue', 'credit', 3),
      ('41200', 'Miscellaneous Fees', 'revenue', 'credit', 3),
      ('41300', 'Laboratory Fees', 'revenue', 'credit', 3),
      ('41400', 'Other Income', 'revenue', 'credit', 3),
      ('50000', 'EXPENSES', 'expense', 'debit', 0),
      ('51100', 'Salaries and Wages', 'expense', 'debit', 3),
      ('51200', 'Utilities Expense', 'expense', 'debit', 3),
      ('51300', 'Rent Expense', 'expense', 'debit', 3),
      ('51400', 'Depreciation Expense', 'expense', 'debit', 3),
      ('51500', 'Supplies Expense', 'expense', 'debit', 3),
      ('51600', 'Professional Fees', 'expense', 'debit', 3),
      ('51700', 'Taxes and Licenses', 'expense', 'debit', 3),
      ('51800', 'Miscellaneous Expense', 'expense', 'debit', 3);

    -- Seed default number series
    INSERT INTO "${schemaName}".number_series (series_type, prefix, starting_number, next_number) VALUES
      ('JE', 'JE', 1, 1),
      ('OR', 'OR', 1, 1),
      ('CV', 'CV', 1, 1);
  `

  await prisma.$executeRawUnsafe(sql)
}

export async function dropEntitySchema(schemaName: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
}
```

- [ ] **Step 2: Update entity service to create schema on entity creation**

Edit `D:\school-accounting\src\services\entity.service.ts`:

After `return entityRepository.create(...)`, add a step to create the schema.

- [ ] **Step 3: Commit**

```bash
git add src/lib/entity-schema.ts src/services/entity.service.ts
git commit -m "feat: add per-entity schema creation with seed data"
```

---

### Task 8: Docker Infrastructure

**Files:**
- Create: `D:\school-accounting\docker\docker-compose.yml`
- Create: `D:\school-accounting\docker\Dockerfile`
- Create: `D:\school-accounting\docker\nginx\default.conf`
- Modify: `D:\school-accounting\.env.example` (add docker-specific vars)

- [ ] **Step 1: Create docker/docker-compose.yml**

```yaml
services:
  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/school_accounting?schema=public
      - REDIS_URL=redis://redis:6379
      - SESSION_SECRET=${SESSION_SECRET:-change-me-in-production}
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=school_accounting
      - POSTGRES_PASSWORD=${DB_PASSWORD:-postgres}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - app
    restart: unless-stopped

volumes:
  pgdata:
  redis_data:
```

- [ ] **Step 2: Create docker/Dockerfile**

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

- [ ] **Step 3: Create docker/nginx/default.conf**

```nginx
upstream app {
    server app:3000;
}

server {
    listen 80;
    server_name _;
    client_max_body_size 10M;

    location / {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /_next/static {
        proxy_pass http://app;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

- [ ] **Step 4: Update .env.example with docker vars**

Add to `D:\school-accounting\.env.example`:
```
DB_PASSWORD=postgres
```

- [ ] **Step 5: Commit**

```bash
git add docker/ .env.example
git commit -m "feat: add Docker infrastructure"
```

---

### Task 9: Seed Script — Default Roles & Super Admin

**Files:**
- Create: `D:\school-accounting\scripts\seed.ts`

- [ ] **Step 1: Create scripts/seed.ts**

```ts
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const rolePermissions: Record<string, { resource: string; action: string }[]> = {
  super_admin: [
    { resource: "accounts", action: "create" },
    { resource: "accounts", action: "read" },
    { resource: "accounts", action: "update" },
    { resource: "accounts", action: "delete" },
    { resource: "journal_entries", action: "create" },
    { resource: "journal_entries", action: "read" },
    { resource: "journal_entries", action: "update" },
    { resource: "journal_entries", action: "post" },
    { resource: "journal_entries", action: "approve" },
    { resource: "reports", action: "read" },
    { resource: "reports", action: "export" },
    { resource: "users", action: "create" },
    { resource: "users", action: "read" },
    { resource: "users", action: "update" },
    { resource: "users", action: "delete" },
    { resource: "entities", action: "create" },
    { resource: "entities", action: "read" },
    { resource: "entities", action: "update" },
    { resource: "entities", action: "delete" },
    { resource: "audit_log", action: "read" },
    { resource: "fiscal_periods", action: "create" },
    { resource: "fiscal_periods", action: "update" },
  ],
  accountant: [
    { resource: "accounts", action: "create" },
    { resource: "accounts", action: "read" },
    { resource: "accounts", action: "update" },
    { resource: "journal_entries", action: "create" },
    { resource: "journal_entries", action: "read" },
    { resource: "journal_entries", action: "post" },
    { resource: "journal_entries", action: "approve" },
    { resource: "reports", action: "read" },
    { resource: "reports", action: "export" },
  ],
  finance_officer: [
    { resource: "accounts", action: "read" },
    { resource: "cash_receipts", action: "create" },
    { resource: "cash_receipts", action: "read" },
    { resource: "cash_disbursements", action: "create" },
    { resource: "cash_disbursements", action: "read" },
    { resource: "student_accounts", action: "read" },
    { resource: "vendor_accounts", action: "read" },
    { resource: "reports", action: "read" },
  ],
  auditor: [
    { resource: "accounts", action: "read" },
    { resource: "journal_entries", action: "read" },
    { resource: "cash_receipts", action: "read" },
    { resource: "cash_disbursements", action: "read" },
    { resource: "student_accounts", action: "read" },
    { resource: "vendor_accounts", action: "read" },
    { resource: "reports", action: "read" },
    { resource: "reports", action: "export" },
    { resource: "audit_log", action: "read" },
  ],
  cashier: [
    { resource: "cash_receipts", action: "create" },
    { resource: "cash_receipts", action: "read" },
    { resource: "official_receipts", action: "create" },
    { resource: "official_receipts", action: "read" },
    { resource: "student_accounts", action: "read" },
    { resource: "reports", action: "read" },
  ],
}

async function main() {
  console.log("Seeding database...")

  // Create permissions
  const permissionMap = new Map<string, string>()
  for (const [_, perms] of Object.entries(rolePermissions)) {
    for (const perm of perms) {
      const key = `${perm.resource}:${perm.action}`
      if (!permissionMap.has(key)) {
        const created = await prisma.permission.upsert({
          where: { resource_action: { resource: perm.resource, action: perm.action } },
          update: {},
          create: { resource: perm.resource, action: perm.action },
        })
        permissionMap.set(key, created.id)
      }
    }
  }

  // Create roles
  for (const [roleName, perms] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, isSystem: true },
    })

    for (const perm of perms) {
      const permId = permissionMap.get(`${perm.resource}:${perm.action}`)
      if (permId) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
          update: {},
          create: { roleId: role.id, permissionId: permId },
        })
      }
    }
  }

  // Create super admin user
  const superAdminRole = await prisma.role.findUnique({ where: { name: "super_admin" } })
  if (superAdminRole) {
    const passwordHash = await bcrypt.hash("admin123", 12)
    await prisma.user.upsert({
      where: { email: "admin@school.edu" },
      update: {},
      create: {
        email: "admin@school.edu",
        passwordHash,
        fullName: "System Administrator",
        roleId: superAdminRole.id,
        isActive: true,
      },
    })
  }

  console.log("Seed complete!")
  console.log("Default login: admin@school.edu / admin123")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

- [ ] **Step 2: Add seed script to package.json scripts**

Already included in Task 1's package.json: `"db:seed": "tsx scripts/seed.ts"`

- [ ] **Step 3: Run seed**

Run: `npx tsx scripts/seed.ts`
Expected: Roles/permissions created, admin user created with default credentials

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat: add seed script with default roles and admin user"
```

---

### Task 10: Login Page UI

**Files:**
- Create: `D:\school-accounting\src\app\globals.css`
- Create: `D:\school-accounting\src\app\layout.tsx`
- Create: `D:\school-accounting\src\app\(auth)\login\page.tsx`
- Create: `D:\school-accounting\src\components\ui\button.tsx`
- Create: `D:\school-accounting\src\components\ui\input.tsx`
- Create: `D:\school-accounting\src\components\ui\label.tsx`
- Create: `D:\school-accounting\src\components\ui\card.tsx`

- [ ] **Step 1: Create src/app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 2: Create src/app/layout.tsx**

```tsx
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "School Accounting System",
  description: "Enterprise school accounting system",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Create shadcn UI components**

Create `src/components/ui/button.tsx`:
```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

Create `src/components/ui/input.tsx`:
```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
```

Create `src/components/ui/label.tsx`:
```tsx
import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
```

Create `src/components/ui/card.tsx`:
```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

export { Card, CardHeader, CardTitle, CardDescription, CardContent }
```

- [ ] **Step 4: Create login page**

Create `D:\school-accounting\src\app\(auth)\login\page.tsx`:
```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      if (!data.success) {
        setError(data.error?.message || "Login failed")
        return
      }

      router.push("/dashboard")
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">School Accounting System</CardTitle>
          <CardDescription>Enter your credentials to sign in</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/ src/components/
git commit -m "feat: add login page UI and shadcn components"
```

---

### Task 11: Dashboard Layout & Navigation

**Files:**
- Create: `D:\school-accounting\src\app\(dashboard)\layout.tsx`
- Create: `D:\school-accounting\src\app\(dashboard)\page.tsx`
- Create: `D:\school-accounting\src\components\dashboard\sidebar.tsx`
- Create: `D:\school-accounting\src\components\dashboard\nav-links.tsx`
- Create: `D:\school-accounting\src\components\dashboard\user-menu.tsx`

- [ ] **Step 1: Create src/components/dashboard/nav-links.tsx**

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const links = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/accounts", label: "Chart of Accounts", icon: "📋" },
  { href: "/dashboard/journal-entries", label: "Journal Entries", icon: "📝" },
  { href: "/dashboard/cash-receipts", label: "Cash Receipts", icon: "💰" },
  { href: "/dashboard/cash-disbursements", label: "Cash Disbursements", icon: "💳" },
  { href: "/dashboard/official-receipts", label: "Official Receipts", icon: "🧾" },
  { href: "/dashboard/student-accounts", label: "Student Accounts", icon: "👨‍🎓" },
  { href: "/dashboard/reports", label: "Reports", icon: "📈" },
  { href: "/dashboard/admin", label: "Admin", icon: "⚙️" },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === link.href
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <span>{link.icon}</span>
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Create src/components/dashboard/user-menu.tsx**

```tsx
"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function UserMenu({ fullName, roleName }: { fullName: string; roleName: string }) {
  const router = useRouter()

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" })
    router.push("/login")
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-t">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fullName}</p>
        <p className="text-xs text-muted-foreground capitalize">{roleName.replace("_", " ")}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        Logout
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Create src/components/dashboard/sidebar.tsx**

```tsx
import { NavLinks } from "./nav-links"
import { UserMenu } from "./user-menu"

interface SidebarProps {
  fullName: string
  roleName: string
}

export function Sidebar({ fullName, roleName }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-4 font-semibold">
        School Accounting
      </div>
      <NavLinks />
      <UserMenu fullName={fullName} roleName={roleName} />
    </aside>
  )
}
```

- [ ] **Step 4: Create src/app/(dashboard)/layout.tsx**

```tsx
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { Sidebar } from "@/components/dashboard/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session.userId) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen">
      <Sidebar fullName={session.fullName} roleName={session.roleName} />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Create src/app/(dashboard)/page.tsx**

```tsx
import { getSession } from "@/lib/auth/session"

export default async function DashboardPage() {
  const session = await getSession()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome back, {session.fullName}
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Accounts</p>
          <p className="text-2xl font-bold">--</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Journal Entries</p>
          <p className="text-2xl font-bold">--</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pending Invoices</p>
          <p className="text-2xl font-bold">--</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Bank Balance</p>
          <p className="text-2xl font-bold">--</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/ src/components/dashboard/
git commit -m "feat: add dashboard layout with sidebar navigation"
```

---

### Task 12: Accounts List & Tree View Page

**Files:**
- Create: `D:\school-accounting\src\app\(dashboard)\accounts\page.tsx`

- [ ] **Step 1: Create accounts page**

```tsx
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { AccountTreeView } from "./account-tree-view"

async function getAccounts(entityId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return []

  const accounts = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "${entity.schemaName}"."account" ORDER BY account_code`
  )
  return accounts
}

export default async function AccountsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")

  if (!hasPermission(session.roleName, "accounts", "read")) {
    redirect("/dashboard")
  }

  if (!session.entityId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Chart of Accounts</h1>
        <p className="text-muted-foreground">Please select an entity to view accounts.</p>
      </div>
    )
  }

  const accounts = await getAccounts(session.entityId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Chart of Accounts</h1>
        <span className="text-sm text-muted-foreground">{accounts.length} accounts</span>
      </div>
      <AccountTreeView accounts={accounts} />
    </div>
  )
}
```

- [ ] **Step 2: Create account tree view component**

Create `D:\school-accounting\src\app\(dashboard)\accounts\account-tree-view.tsx`:
```tsx
"use client"

import { useState } from "react"

interface Account {
  id: string
  account_code: string
  account_name: string
  account_type: string
  normal_balance: string
  level: number
  is_active: boolean
  parent_id: string | null
}

function buildTree(accounts: Account[]): (Account & { children: Account[] })[] {
  const map = new Map<string, Account & { children: Account[] }>()
  const roots: (Account & { children: Account[] })[] = []

  accounts.forEach((acc) => {
    map.set(acc.id, { ...acc, children: [] })
  })

  accounts.forEach((acc) => {
    const node = map.get(acc.id)!
    if (acc.parent_id && map.has(acc.parent_id)) {
      map.get(acc.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}

function AccountNode({ account, depth }: { account: Account & { children: Account[] }; depth: number }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = account.children.length > 0

  const typeColors: Record<string, string> = {
    asset: "text-emerald-600",
    liability: "text-orange-600",
    equity: "text-blue-600",
    revenue: "text-green-600",
    expense: "text-red-600",
    contra_asset: "text-rose-600",
    contra_revenue: "text-pink-600",
    contra_liability: "text-amber-600",
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded cursor-pointer"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-4 text-center text-xs text-muted-foreground">
          {hasChildren ? (expanded ? "▼" : "▶") : "·"}
        </span>
        <span className="font-mono text-xs text-muted-foreground w-16">{account.account_code}</span>
        <span className={`text-sm ${typeColors[account.account_type] || ""}`}>
          {account.account_name}
        </span>
        <span className="text-xs text-muted-foreground ml-2">
          ({account.account_type}, {account.normal_balance})
        </span>
        {!account.is_active && (
          <span className="text-xs text-red-500 ml-2">Inactive</span>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {account.children.map((child) => (
            <AccountNode key={child.id} account={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function AccountTreeView({ accounts }: { accounts: Account[] }) {
  const tree = buildTree(accounts)

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4">
        <AccountNode account={{ id: "root", account_code: "", account_name: "Chart of Accounts", account_type: "", normal_balance: "", level: -1, is_active: true, parent_id: null, children: tree }} depth={-1} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/accounts/
git commit -m "feat: add chart of accounts tree view page"
```

---

### Task 13: Self-Review & Verification

- [ ] **Step 1: Verify build succeeds**

Run: `npm run build` (if Next.js is properly configured)
Expected: Build completes without errors

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Verify DB connection**

Run: `npx prisma db push`
Expected: Database tables created in public and audit schemas

- [ ] **Step 4: Verify seed**

Run: `npx tsx scripts/seed.ts`
Expected: Roles, permissions, admin user created

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: Phase 1 foundation complete"
```

# Phase 5: Fixed Assets & Bank Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Fixed Assets (asset register, straight-line depreciation, disposal) and Bank Reconciliation (statement upload, matching, adjustments) modules.

**Architecture:** Each module follows the existing pattern: service layer with business logic, API routes with RBAC auth, and server-rendered UI pages. All tables already exist in `entity-schema.ts` (from Phase 1) — no DB schema changes needed. Depreciation creates JEs via the posting engine. Bank reconciliation includes a basic CSV parser.

**Tech Stack:** Next.js 14 Server Components, raw SQL for per-entity queries, existing posting-engine.ts and audit-log.ts.

---

## File Structure

**New services (2):**
- `src/services/fixed-asset.service.ts`
- `src/services/bank-reconciliation.service.ts`

**New API routes (9):**
- `src/app/api/v1/fixed-assets/route.ts`
- `src/app/api/v1/fixed-assets/[id]/route.ts`
- `src/app/api/v1/fixed-assets/[id]/depreciate/route.ts`
- `src/app/api/v1/fixed-assets/[id]/dispose/route.ts`
- `src/app/api/v1/bank-accounts/route.ts`
- `src/app/api/v1/bank-reconciliation/route.ts`
- `src/app/api/v1/bank-reconciliation/[id]/route.ts`
- `src/app/api/v1/bank-reconciliation/[id]/items/route.ts`
- `src/app/api/v1/bank-reconciliation/[id]/reconcile/route.ts`

**New UI pages (6):**
- `src/app/(dashboard)/fixed-assets/page.tsx`
- `src/app/(dashboard)/fixed-assets/new/page.tsx`
- `src/app/(dashboard)/fixed-assets/[id]/page.tsx`
- `src/app/(dashboard)/bank-reconciliation/page.tsx`
- `src/app/(dashboard)/bank-reconciliation/new/page.tsx`
- `src/app/(dashboard)/bank-reconciliation/[id]/page.tsx`

**Modified (2):**
- `src/lib/auth/rbac.ts` — add fixed_assets + bank_reconciliation permissions
- `src/components/dashboard/nav-links.tsx` — add FA + BR sidebar links

---

### Task 1: Fixed Assets Service

**Files:**
- Create: `src/services/fixed-asset.service.ts`

- [ ] **Step 1: Create fixed asset service**

```ts
import { prisma } from "@/lib/db"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { auditLog } from "@/lib/audit/audit-log"

export const fixedAssetService = {
  async list(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT *,
        (acquisition_cost - accumulated_depreciation) as net_book_value
       FROM "${entitySchema}".fixed_asset
       ORDER BY acquisition_date DESC
       LIMIT 100`
    )
  },

  async getById(entitySchema: string, id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT fa.*,
        (SELECT COALESCE(JSON_AGG(json_build_object(
          'id', de.id, 'fiscal_period_id', de.fiscal_period_id,
          'depreciation_amount', de.depreciation_amount,
          'created_at', de.created_at
        ) ORDER BY de.created_at), '[]'::json)
         FROM "${entitySchema}".depreciation_entry de WHERE de.fixed_asset_id = fa.id) as depreciation_schedule
       FROM "${entitySchema}".fixed_asset fa
       WHERE fa.id = $1`, id
    )
    return rows[0] || null
  },

  async create(entitySchema: string, data: {
    assetCode: string; assetName: string; assetCategory: string
    acquisitionDate: string; acquisitionCost: number
    estimatedLifeYears: number; salvageValue?: number
  }) {
    return prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".fixed_asset (asset_code, asset_name, asset_category, acquisition_date, acquisition_cost, estimated_life_years, salvage_value)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7) RETURNING *`,
      data.assetCode, data.assetName, data.assetCategory,
      data.acquisitionDate, data.acquisitionCost,
      data.estimatedLifeYears, data.salvageValue || 0
    ).then(r => r[0])
  },

  async update(entitySchema: string, id: string, data: {
    assetName?: string; assetCategory?: string; acquisitionCost?: number
    estimatedLifeYears?: number; salvageValue?: number
  }) {
    const sets: string[] = []
    const vals: any[] = []
    let i = 1
    if (data.assetName !== undefined) { sets.push(`asset_name = $${i}`); vals.push(data.assetName); i++ }
    if (data.assetCategory !== undefined) { sets.push(`asset_category = $${i}`); vals.push(data.assetCategory); i++ }
    if (data.acquisitionCost !== undefined) { sets.push(`acquisition_cost = $${i}`); vals.push(data.acquisitionCost); i++ }
    if (data.estimatedLifeYears !== undefined) { sets.push(`estimated_life_years = $${i}`); vals.push(data.estimatedLifeYears); i++ }
    if (data.salvageValue !== undefined) { sets.push(`salvage_value = $${i}`); vals.push(data.salvageValue); i++ }
    vals.push(id)
    return prisma.$queryRawUnsafe<any[]>(
      `UPDATE "${entitySchema}".fixed_asset SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${i} AND status = 'active' RETURNING *`,
      ...vals
    ).then(r => r[0])
  },

  async getDepreciationSchedule(entitySchema: string, assetId: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT de.*, je.entry_number
       FROM "${entitySchema}".depreciation_entry de
       LEFT JOIN "${entitySchema}".journal_entry je ON je.id = de.journal_entry_id
       WHERE de.fixed_asset_id = $1
       ORDER BY de.created_at`, assetId
    )
  },

  async depreciate(entitySchema: string, assetId: string, fiscalPeriodId: string, userId: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".fixed_asset WHERE id = $1`, assetId
    )
    const asset = rows[0]
    if (!asset) throw new Error("Asset not found")
    if (asset.status !== "active") throw new Error("Only active assets can be depreciated")

    const depreciableBase = Number(asset.acquisition_cost) - Number(asset.salvage_value)
    const accumulated = Number(asset.accumulated_depreciation)
    if (accumulated >= depreciableBase) throw new Error("Asset is already fully depreciated")

    const monthlyDep = depreciableBase / (Number(asset.estimated_life_years) * 12)
    const remaining = depreciableBase - accumulated
    const depAmount = Math.min(monthlyDep, remaining)

    const accounts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, account_code FROM "${entitySchema}".account WHERE account_code IN ($1, $2)`,
      "51400",
      asset.asset_category === "building" ? "12130" : "12150"
    )
    const depExpenseId = accounts.find((a: any) => a.account_code === "51400")?.id
    const accumCode = asset.asset_category === "building" ? "12130" : "12150"
    const accumId = accounts.find((a: any) => a.account_code === accumCode)?.id
    if (!depExpenseId || !accumId) throw new Error("Required accounts not found")

    const je = await postingEngine.post(entitySchema, {
      entryDate: new Date().toISOString().split("T")[0],
      sourceModule: "FA",
      description: `Depreciation - ${asset.asset_name} (${asset.asset_code})`,
      createdBy: userId,
      lines: [
        { accountId: depExpenseId, debit: depAmount, credit: 0 },
        { accountId: accumId, debit: 0, credit: depAmount },
      ],
    })

    await prisma.$queryRawUnsafe(
      `INSERT INTO "${entitySchema}".depreciation_entry (fixed_asset_id, fiscal_period_id, depreciation_amount, journal_entry_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (fixed_asset_id, fiscal_period_id) DO NOTHING`,
      assetId, fiscalPeriodId, depAmount, je.id
    )

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".fixed_asset
       SET accumulated_depreciation = accumulated_depreciation + $1,
           status = CASE WHEN accumulated_depreciation + $1 >= $2 THEN 'fully_depreciated' ELSE 'active' END
       WHERE id = $3`,
      depAmount, depreciableBase, assetId
    )

    await auditLog.log(entitySchema, {
      action: "post",
      recordType: "depreciation",
      recordId: assetId,
      userId,
      description: `Depreciation ${depAmount} for ${asset.asset_name}`,
    })

    return { journalEntry: je, depreciationAmount: depAmount }
  },

  async dispose(entitySchema: string, assetId: string, disposalDate: string, disposalAmount: number, userId: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".fixed_asset WHERE id = $1`, assetId
    )
    const asset = rows[0]
    if (!asset) throw new Error("Asset not found")
    if (asset.status === "disposed") throw new Error("Asset already disposed")

    const cost = Number(asset.acquisition_cost)
    const accumDep = Number(asset.accumulated_depreciation)
    const bookValue = cost - accumDep
    const gainLoss = disposalAmount - bookValue

    const accounts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, account_code FROM "${entitySchema}".account WHERE account_code IN ($1, $2, $3, $4)`,
      asset.asset_category === "building" ? "12120" : "12140",
      asset.asset_category === "building" ? "12130" : "12150",
      "41500",
      "51900"
    )
    const assetAccountCode = asset.asset_category === "building" ? "12120" : "12140"
    const accumCode = asset.asset_category === "building" ? "12130" : "12150"
    const assetAccountId = accounts.find((a: any) => a.account_code === assetAccountCode)?.id
    const accumId = accounts.find((a: any) => a.account_code === accumCode)?.id
    const gainId = accounts.find((a: any) => a.account_code === "41500")?.id
    const lossId = accounts.find((a: any) => a.account_code === "51900")?.id
    if (!assetAccountId || !accumId) throw new Error("Required asset/accum accounts not found")

    const lines: { accountId: string; debit: number; credit: number }[] = []

    if (gainLoss > 0) {
      lines.push({ accountId: assetAccountId, debit: 0, credit: cost })
      lines.push({ accountId: accumId, debit: accumDep, credit: 0 })
      if (gainId) lines.push({ accountId: gainId, debit: 0, credit: gainLoss })
    } else {
      lines.push({ accountId: assetAccountId, debit: 0, credit: cost })
      lines.push({ accountId: accumId, debit: accumDep, credit: 0 })
      if (lossId) lines.push({ accountId: lossId, debit: Math.abs(gainLoss), credit: 0 })
    }

    const je = await postingEngine.post(entitySchema, {
      entryDate: disposalDate,
      sourceModule: "FA",
      description: `Disposal - ${asset.asset_name} (${asset.asset_code})`,
      createdBy: userId,
      lines,
    })

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".fixed_asset
       SET status = 'disposed', disposal_date = $1::date, disposal_amount = $2, journal_entry_id = $3
       WHERE id = $4`,
      disposalDate, disposalAmount, je.id, assetId
    )

    await auditLog.log(entitySchema, {
      action: "post",
      recordType: "fixed_asset_disposal",
      recordId: assetId,
      userId,
      description: `Disposed ${asset.asset_name} - ${disposalAmount}`,
    })

    return { journalEntry: je, gainLoss }
  },
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 2: Fixed Assets API Routes

**Files:**
- Create: `src/app/api/v1/fixed-assets/route.ts`
- Create: `src/app/api/v1/fixed-assets/[id]/route.ts`
- Create: `src/app/api/v1/fixed-assets/[id]/depreciate/route.ts`
- Create: `src/app/api/v1/fixed-assets/[id]/dispose/route.ts`

- [ ] **Step 1: Create fixed-assets list + create route**

Create `src/app/api/v1/fixed-assets/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { fixedAssetService } from "@/services/fixed-asset.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "fixed_assets", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const result = await fixedAssetService.list(schema)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Fixed assets list error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list assets"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "fixed_assets", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const result = await fixedAssetService.create(schema, body)
    return NextResponse.json(formatApiResponse(result), { status: 201 })
  } catch (error) {
    console.error("Fixed asset create error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to create asset"), { status: 500 })
  }
}
```

- [ ] **Step 2: Create fixed-assets get/update route**

Create `src/app/api/v1/fixed-assets/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { fixedAssetService } from "@/services/fixed-asset.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "fixed_assets", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const result = await fixedAssetService.getById(schema, id)
    if (!result) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Asset not found"), { status: 404 })
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Fixed asset get error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get asset"), { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "fixed_assets", "update")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const result = await fixedAssetService.update(schema, id, body)
    if (!result) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Asset not found or not active"), { status: 404 })
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Fixed asset update error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to update asset"), { status: 500 })
  }
}
```

- [ ] **Step 3: Create fixed-assets depreciate route**

Create `src/app/api/v1/fixed-assets/[id]/depreciate/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { fixedAssetService } from "@/services/fixed-asset.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "fixed_assets", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const result = await fixedAssetService.depreciate(schema, id, body.fiscalPeriodId, session.userId)
    return NextResponse.json(formatApiResponse(result))
  } catch (error: any) {
    console.error("Depreciate error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", error.message || "Failed to depreciate"), { status: 500 })
  }
}
```

- [ ] **Step 4: Create fixed-assets dispose route**

Create `src/app/api/v1/fixed-assets/[id]/dispose/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { fixedAssetService } from "@/services/fixed-asset.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "fixed_assets", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const result = await fixedAssetService.dispose(schema, id, body.disposalDate, body.disposalAmount, session.userId)
    return NextResponse.json(formatApiResponse(result))
  } catch (error: any) {
    console.error("Dispose error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", error.message || "Failed to dispose"), { status: 500 })
  }
}
```

- [ ] **Step 5: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 3: Fixed Assets UI Pages

**Files:**
- Create: `src/app/(dashboard)/fixed-assets/page.tsx`
- Create: `src/app/(dashboard)/fixed-assets/new/page.tsx`
- Create: `src/app/(dashboard)/fixed-assets/[id]/page.tsx`

- [ ] **Step 1: Create fixed assets list page**

Create `src/app/(dashboard)/fixed-assets/page.tsx`:

```tsx
import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { fixedAssetService } from "@/services/fixed-asset.service"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function FixedAssetsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "fixed_assets", "read")) redirect("/dashboard")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const assets = await fixedAssetService.list(entity.schemaName)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Fixed Assets</h1>
        <Link href="/dashboard/fixed-assets/new"><Button>Capitalize Asset</Button></Link>
      </div>
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Asset Code</th>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-right p-3 font-medium">Cost</th>
                <th className="text-right p-3 font-medium">Accum. Depr.</th>
                <th className="text-right p-3 font-medium">Net Book Value</th>
                <th className="text-left p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 && <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">No assets found.</td></tr>}
              {assets.map((a: any) => (
                <tr key={a.id} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/dashboard/fixed-assets/${a.id}`} className="text-blue-600 hover:underline">{a.asset_code}</Link>
                  </td>
                  <td className="p-3">{a.asset_name}</td>
                  <td className="p-3 text-xs capitalize">{a.asset_category}</td>
                  <td className="p-3 text-right font-mono">{Number(a.acquisition_cost).toFixed(2)}</td>
                  <td className="p-3 text-right font-mono">{Number(a.accumulated_depreciation).toFixed(2)}</td>
                  <td className="p-3 text-right font-mono">{Number(a.net_book_value).toFixed(2)}</td>
                  <td className="p-3 text-xs capitalize">{a.status.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create fixed assets capitalize form page**

Create `src/app/(dashboard)/fixed-assets/new/page.tsx`:

```tsx
"use client"

import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const assetCategories = [
  "building", "equipment", "furniture", "vehicle", "computer", "land", "other"
]

export default function NewFixedAssetPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch("/api/v1/fixed-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetCode: form.get("assetCode"),
          assetName: form.get("assetName"),
          assetCategory: form.get("assetCategory"),
          acquisitionDate: form.get("acquisitionDate"),
          acquisitionCost: Number(form.get("acquisitionCost")),
          estimatedLifeYears: Number(form.get("estimatedLifeYears")),
          salvageValue: Number(form.get("salvageValue")) || 0,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || "Failed to create asset")
      }
      router.push("/dashboard/fixed-assets")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Capitalize Asset</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="assetCode">Asset Code</Label>
          <Input id="assetCode" name="assetCode" required placeholder="e.g. BLDG-001" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assetName">Asset Name</Label>
          <Input id="assetName" name="assetName" required placeholder="e.g. Main Building" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assetCategory">Category</Label>
          <select id="assetCategory" name="assetCategory" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
            {assetCategories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="acquisitionDate">Acquisition Date</Label>
          <Input id="acquisitionDate" name="acquisitionDate" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="acquisitionCost">Acquisition Cost (PHP)</Label>
          <Input id="acquisitionCost" name="acquisitionCost" type="number" step="0.01" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimatedLifeYears">Estimated Life (Years)</Label>
          <Input id="estimatedLifeYears" name="estimatedLifeYears" type="number" min="1" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salvageValue">Salvage Value (PHP)</Label>
          <Input id="salvageValue" name="salvageValue" type="number" step="0.01" defaultValue="0" />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating..." : "Capitalize Asset"}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Create fixed asset detail page**

Create `src/app/(dashboard)/fixed-assets/[id]/page.tsx`:

```tsx
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { fixedAssetService } from "@/services/fixed-asset.service"
import { prisma } from "@/lib/db"
import { AssetActions } from "./asset-actions"

export const dynamic = "force-dynamic"

export default async function FixedAssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "fixed_assets", "read")) redirect("/dashboard")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const asset = await fixedAssetService.getById(entity.schemaName, id)
  if (!asset) return <p className="p-6 text-muted-foreground">Asset not found.</p>

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold">{asset.asset_name}</h1>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Asset Code</p>
            <p className="font-mono">{asset.asset_code}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Category</p>
            <p className="capitalize">{asset.asset_category}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Acquisition Date</p>
            <p>{new Date(asset.acquisition_date).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cost</p>
            <p className="font-mono">{Number(asset.acquisition_cost).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Accum. Depreciation</p>
            <p className="font-mono">{Number(asset.accumulated_depreciation).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Net Book Value</p>
            <p className="font-mono">{(Number(asset.acquisition_cost) - Number(asset.accumulated_depreciation)).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Life (Years)</p>
            <p>{asset.estimated_life_years}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Salvage Value</p>
            <p className="font-mono">{Number(asset.salvage_value).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="capitalize">{asset.status.replace("_", " ")}</p>
          </div>
          {asset.disposal_date && (
            <>
              <div>
                <p className="text-sm text-muted-foreground">Disposal Date</p>
                <p>{new Date(asset.disposal_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Disposal Amount</p>
                <p className="font-mono">{Number(asset.disposal_amount).toFixed(2)}</p>
              </div>
            </>
          )}
        </div>

        <AssetActions assetId={asset.id} status={asset.status} />
      </div>

      <h2 className="text-xl font-semibold">Depreciation Schedule</h2>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Period</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">JE #</th>
              <th className="text-left p-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {(asset.depreciation_schedule || []).length === 0 && (
              <tr><td colSpan={4} className="text-center p-6 text-muted-foreground">No depreciation entries.</td></tr>
            )}
            {(asset.depreciation_schedule || []).map((d: any) => (
              <tr key={d.id} className="border-b">
                <td className="p-3 text-xs">{d.fiscal_period_id?.slice(0, 8) || "—"}</td>
                <td className="p-3 text-right font-mono">{Number(d.depreciation_amount).toFixed(2)}</td>
                <td className="p-3 text-xs font-mono">{d.journal_entry_id?.entry_number || d.journal_entry_id?.slice(0, 8) || "—"}</td>
                <td className="p-3 text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create asset actions client component**

Create `src/app/(dashboard)/fixed-assets/[id]/asset-actions.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function AssetActions({ assetId, status }: { assetId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState("")
  const [error, setError] = useState("")

  async function handleDepreciate() {
    setLoading("depreciate")
    setError("")
    try {
      const res = await fetch(`/api/v1/fixed-assets/${assetId}/depreciate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscalPeriodId: crypto.randomUUID() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || "Failed")
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading("")
    }
  }

  async function handleDispose() {
    const date = prompt("Disposal date (YYYY-MM-DD):")
    if (!date) return
    const amount = prompt("Disposal amount (PHP):")
    if (!amount) return
    setLoading("dispose")
    setError("")
    try {
      const res = await fetch(`/api/v1/fixed-assets/${assetId}/dispose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposalDate: date, disposalAmount: Number(amount) }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || "Failed")
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading("")
    }
  }

  if (status === "disposed") return null

  return (
    <div className="flex gap-2 pt-2">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {status === "active" && (
        <Button variant="outline" onClick={handleDepreciate} disabled={loading === "depreciate"}>
          {loading === "depreciate" ? "Processing..." : "Run Depreciation"}
        </Button>
      )}
      {(status === "active" || status === "fully_depreciated") && (
        <Button variant="destructive" onClick={handleDispose} disabled={loading === "dispose"}>
          {loading === "dispose" ? "Processing..." : "Dispose"}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 4: Bank Reconciliation Service

**Files:**
- Create: `src/services/bank-reconciliation.service.ts`

- [ ] **Step 1: Create bank reconciliation service**

```ts
import { prisma } from "@/lib/db"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { auditLog } from "@/lib/audit/audit-log"

export const bankReconciliationService = {
  async listBankAccounts(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".bank_account ORDER BY bank_name`
    )
  },

  async createBankAccount(entitySchema: string, data: {
    accountCode?: string; bankName: string; accountNumber: string
    accountType: string; currency?: string
  }) {
    return prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".bank_account (account_code, bank_name, account_number, account_type, currency)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      data.accountCode || null, data.bankName, data.accountNumber, data.accountType, data.currency || "PHP"
    ).then(r => r[0])
  },

  async list(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT br.*, ba.bank_name, ba.account_number
       FROM "${entitySchema}".bank_reconciliation br
       LEFT JOIN "${entitySchema}".bank_account ba ON ba.id = br.bank_account_id
       ORDER BY br.created_at DESC
       LIMIT 100`
    )
  },

  async start(entitySchema: string, data: {
    bankAccountId: string; statementDate: string
    statementEndingBalance: number; bookEndingBalance: number
  }, userId: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".bank_reconciliation (bank_account_id, statement_date, statement_ending_balance, book_ending_balance, created_by)
       VALUES ($1, $2::date, $3, $4, $5) RETURNING *`,
      data.bankAccountId, data.statementDate, data.statementEndingBalance, data.bookEndingBalance, userId
    ).then(r => r[0])
  },

  async getById(entitySchema: string, id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT br.*, ba.bank_name, ba.account_number
       FROM "${entitySchema}".bank_reconciliation br
       LEFT JOIN "${entitySchema}".bank_account ba ON ba.id = br.bank_account_id
       WHERE br.id = $1`, id
    )
    const reconciliation = rows[0]
    if (!reconciliation) return null

    const items = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".reconciliation_item
       WHERE reconciliation_id = $1
       ORDER BY created_at`, id
    )

    return { ...reconciliation, items }
  },

  async addItem(entitySchema: string, reconciliationId: string, data: {
    type: string; reference?: string; amount: number; isCleared?: boolean
  }) {
    return prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".reconciliation_item (reconciliation_id, type, reference, amount, is_cleared)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      reconciliationId, data.type, data.reference || null, data.amount, data.isCleared || false
    ).then(r => r[0])
  },

  parseCSV(csvContent: string): { date: string; description: string; debit: number; credit: number; reference: string }[] {
    const lines = csvContent.trim().split("\n")
    if (lines.length < 2) return []

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase())
    const dateIdx = headers.findIndex(h => h.includes("date"))
    const descIdx = headers.findIndex(h => h.includes("desc") || h.includes("detail") || h.includes("narrative") || h.includes("particular"))
    const debitIdx = headers.findIndex(h => h === "debit" || h === "debit_amount" || h.includes("withdrawal") || h.includes("outflow"))
    const creditIdx = headers.findIndex(h => h === "credit" || h === "credit_amount" || h.includes("deposit") || h.includes("inflow"))
    const refIdx = headers.findIndex(h => h.includes("ref") || h.includes("check") || h.includes("number"))

    const results: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""))
      const date = dateIdx >= 0 ? cols[dateIdx] : ""
      const description = descIdx >= 0 ? cols[descIdx] : ""
      const debit = debitIdx >= 0 ? parseFloat(cols[debitIdx] || "0") || 0 : 0
      const credit = creditIdx >= 0 ? parseFloat(cols[creditIdx] || "0") || 0 : 0
      const reference = refIdx >= 0 ? cols[refIdx] : ""
      if (date || description || debit || credit) {
        results.push({ date, description, debit, credit, reference })
      }
    }
    return results
  },

  async uploadStatement(entitySchema: string, reconciliationId: string, csvContent: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".bank_reconciliation WHERE id = $1`, reconciliationId
    )
    if (!rows[0]) throw new Error("Reconciliation not found")

    const transactions = this.parseCSV(csvContent)
    const created: any[] = []

    for (const txn of transactions) {
      let itemType = "deposit_in_transit"
      if (txn.debit > 0) itemType = "outstanding_check"
      if (txn.debit === 0 && txn.credit === 0) continue

      const item = await prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "${entitySchema}".reconciliation_item (reconciliation_id, type, reference, amount)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        reconciliationId, itemType, txn.reference || txn.description, txn.debit > 0 ? txn.debit : txn.credit
      )
      created.push({ ...item[0], _date: txn.date, _description: txn.description })
    }

    return created
  },

  async reconcile(entitySchema: string, reconciliationId: string, userId: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".bank_reconciliation WHERE id = $1`, reconciliationId
    )
    const rec = rows[0]
    if (!rec) throw new Error("Reconciliation not found")
    if (rec.status === "completed") throw new Error("Already completed")

    const items = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".reconciliation_item WHERE reconciliation_id = $1`, reconciliationId
    )

    const totalOutstandingChecks = items
      .filter((i: any) => i.type === "outstanding_check" && !i.is_cleared)
      .reduce((s: number, i: any) => s + Number(i.amount), 0)
    const totalDepositsInTransit = items
      .filter((i: any) => i.type === "deposit_in_transit" && !i.is_cleared)
      .reduce((s: number, i: any) => s + Number(i.amount), 0)

    const adjItems = items.filter((i: any) =>
      ["bank_charge", "interest", "nsf", "bank_error", "book_error"].includes(i.type)
    )

    for (const item of adjItems) {
      if (item.journal_entry_id) continue

      const accounts = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, account_code FROM "${entitySchema}".account WHERE account_code = $1`,
        "11120"
      )
      const cashBankId = accounts[0]?.id
      if (!cashBankId) throw new Error("Cash in Bank account not found")

      let description = ""
      let drAccountId = cashBankId
      let crAccountId = cashBankId

      switch (item.type) {
        case "bank_charge":
          description = `Bank charge - ${item.reference || ""}`
          drAccountId = cashBankId
          break
        case "interest":
          description = `Interest income - ${item.reference || ""}`
          crAccountId = cashBankId
          break
        case "nsf":
          description = `NSF check - ${item.reference || ""}`
          drAccountId = cashBankId
          break
        default:
          description = `Adjustment - ${item.type} ${item.reference || ""}`
      }

      if (!drAccountId || !crAccountId) continue

      const je = await postingEngine.post(entitySchema, {
        entryDate: new Date().toISOString().split("T")[0],
        sourceModule: "BR",
        description,
        createdBy: userId,
        lines: [
          { accountId: drAccountId, debit: Math.abs(Number(item.amount)), credit: 0 },
          { accountId: crAccountId, debit: 0, credit: Math.abs(Number(item.amount)) },
        ],
      })

      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".reconciliation_item SET journal_entry_id = $1, is_cleared = TRUE WHERE id = $2`,
        je.id, item.id
      )
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".reconciliation_item SET is_cleared = TRUE WHERE reconciliation_id = $1 AND type IN ('deposit_in_transit', 'outstanding_check')`,
      reconciliationId
    )

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".bank_reconciliation SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      reconciliationId
    )

    await auditLog.log(entitySchema, {
      action: "post",
      recordType: "bank_reconciliation",
      recordId: reconciliationId,
      userId,
      description: `Completed bank reconciliation`,
    })

    return { status: "completed" }
  },
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 5: Bank Accounts API Route

**Files:**
- Create: `src/app/api/v1/bank-accounts/route.ts`

- [ ] **Step 1: Create bank accounts list + create route**

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { bankReconciliationService } from "@/services/bank-reconciliation.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "bank_reconciliation", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const result = await bankReconciliationService.listBankAccounts(schema)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Bank accounts list error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list accounts"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "bank_reconciliation", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const result = await bankReconciliationService.createBankAccount(schema, body)
    return NextResponse.json(formatApiResponse(result), { status: 201 })
  } catch (error) {
    console.error("Bank account create error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to create account"), { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 6: Bank Reconciliation API Routes

**Files:**
- Create: `src/app/api/v1/bank-reconciliation/route.ts`
- Create: `src/app/api/v1/bank-reconciliation/[id]/route.ts`
- Create: `src/app/api/v1/bank-reconciliation/[id]/items/route.ts`
- Create: `src/app/api/v1/bank-reconciliation/[id]/reconcile/route.ts`

- [ ] **Step 1: Create bank-reconciliation list + start route**

Create `src/app/api/v1/bank-reconciliation/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { bankReconciliationService } from "@/services/bank-reconciliation.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "bank_reconciliation", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const result = await bankReconciliationService.list(schema)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Bank reconciliation list error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list reconciliations"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "bank_reconciliation", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const result = await bankReconciliationService.start(schema, body, session.userId)
    return NextResponse.json(formatApiResponse(result), { status: 201 })
  } catch (error) {
    console.error("Bank reconciliation start error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to start reconciliation"), { status: 500 })
  }
}
```

- [ ] **Step 2: Create bank-reconciliation detail route**

Create `src/app/api/v1/bank-reconciliation/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { bankReconciliationService } from "@/services/bank-reconciliation.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "bank_reconciliation", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const result = await bankReconciliationService.getById(schema, id)
    if (!result) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Reconciliation not found"), { status: 404 })
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Bank reconciliation get error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get reconciliation"), { status: 500 })
  }
}
```

- [ ] **Step 3: Create bank-reconciliation items route**

Create `src/app/api/v1/bank-reconciliation/[id]/items/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { bankReconciliationService } from "@/services/bank-reconciliation.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "bank_reconciliation", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const result = await bankReconciliationService.addItem(schema, id, body)
    return NextResponse.json(formatApiResponse(result), { status: 201 })
  } catch (error) {
    console.error("Add item error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to add item"), { status: 500 })
  }
}
```

- [ ] **Step 4: Create bank-reconciliation reconcile route**

Create `src/app/api/v1/bank-reconciliation/[id]/reconcile/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { bankReconciliationService } from "@/services/bank-reconciliation.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "bank_reconciliation", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const result = await bankReconciliationService.reconcile(schema, id, session.userId)
    return NextResponse.json(formatApiResponse(result))
  } catch (error: any) {
    console.error("Reconcile error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", error.message || "Failed to reconcile"), { status: 500 })
  }
}
```

- [ ] **Step 5: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 7: Bank Reconciliation UI Pages

**Files:**
- Create: `src/app/(dashboard)/bank-reconciliation/page.tsx`
- Create: `src/app/(dashboard)/bank-reconciliation/new/page.tsx`
- Create: `src/app/(dashboard)/bank-reconciliation/[id]/page.tsx`

- [ ] **Step 1: Create bank reconciliation list page**

Create `src/app/(dashboard)/bank-reconciliation/page.tsx`:

```tsx
import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { bankReconciliationService } from "@/services/bank-reconciliation.service"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function BankReconciliationPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "bank_reconciliation", "read")) redirect("/dashboard")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const bankAccounts = await bankReconciliationService.listBankAccounts(entity.schemaName)
  const reconciliations = await bankReconciliationService.list(entity.schemaName)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Bank Reconciliation</h1>
        <Link href="/dashboard/bank-reconciliation/new"><Button>New Reconciliation</Button></Link>
      </div>

      <h2 className="text-xl font-semibold">Bank Accounts</h2>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Bank</th>
              <th className="text-left p-3 font-medium">Account #</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Currency</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {bankAccounts.length === 0 && <tr><td colSpan={5} className="text-center p-6 text-muted-foreground">No bank accounts. Create one first.</td></tr>}
            {bankAccounts.map((b: any) => (
              <tr key={b.id} className="border-b">
                <td className="p-3">{b.bank_name}</td>
                <td className="p-3 font-mono text-xs">{b.account_number}</td>
                <td className="p-3 text-xs capitalize">{b.account_type}</td>
                <td className="p-3 text-xs">{b.currency}</td>
                <td className="p-3 text-xs">{b.is_active ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold">Reconciliation History</h2>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Bank</th>
              <th className="text-left p-3 font-medium">Statement Date</th>
              <th className="text-right p-3 font-medium">Statement Balance</th>
              <th className="text-right p-3 font-medium">Book Balance</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {reconciliations.length === 0 && <tr><td colSpan={5} className="text-center p-6 text-muted-foreground">No reconciliations yet.</td></tr>}
            {reconciliations.map((r: any) => (
              <tr key={r.id} className="border-b hover:bg-muted/50">
                <td className="p-3">
                  <Link href={`/dashboard/bank-reconciliation/${r.id}`} className="text-blue-600 hover:underline">{r.bank_name}</Link>
                </td>
                <td className="p-3">{new Date(r.statement_date).toLocaleDateString()}</td>
                <td className="p-3 text-right font-mono">{Number(r.statement_ending_balance).toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{Number(r.book_ending_balance).toFixed(2)}</td>
                <td className="p-3 text-xs capitalize">{r.status.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create bank reconciliation start page**

Create `src/app/(dashboard)/bank-reconciliation/new/page.tsx`:

```tsx
"use client"

import { useState, FormEvent, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function NewBankReconciliationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [bankAccounts, setBankAccounts] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/v1/bank-accounts").then(r => r.json()).then(d => {
      if (d.success) setBankAccounts(d.data || [])
    }).catch(() => {})
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch("/api/v1/bank-reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId: form.get("bankAccountId"),
          statementDate: form.get("statementDate"),
          statementEndingBalance: Number(form.get("statementEndingBalance")),
          bookEndingBalance: Number(form.get("bookEndingBalance")),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || "Failed to create")
      }
      const data = await res.json()
      router.push(`/dashboard/bank-reconciliation/${data.data.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-3xl font-bold">New Bank Reconciliation</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bankAccountId">Bank Account</Label>
          <select id="bankAccountId" name="bankAccountId" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
            <option value="">Select bank account...</option>
            {bankAccounts.map((b: any) => (
              <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="statementDate">Statement Date</Label>
          <Input id="statementDate" name="statementDate" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="statementEndingBalance">Statement Ending Balance</Label>
          <Input id="statementEndingBalance" name="statementEndingBalance" type="number" step="0.01" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bookEndingBalance">Book Ending Balance</Label>
          <Input id="bookEndingBalance" name="bookEndingBalance" type="number" step="0.01" required />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating..." : "Start Reconciliation"}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Create bank reconciliation detail page**

Create `src/app/(dashboard)/bank-reconciliation/[id]/page.tsx`:

```tsx
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { bankReconciliationService } from "@/services/bank-reconciliation.service"
import { prisma } from "@/lib/db"
import { ReconciliationActions } from "./reconciliation-actions"

export const dynamic = "force-dynamic"

export default async function BankReconciliationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "bank_reconciliation", "read")) redirect("/dashboard")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const rec = await bankReconciliationService.getById(entity.schemaName, id)
  if (!rec) return <p className="p-6 text-muted-foreground">Reconciliation not found.</p>

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-3xl font-bold">Bank Reconciliation</h1>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Bank</p>
            <p>{rec.bank_name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Account #</p>
            <p className="font-mono">{rec.account_number}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Statement Date</p>
            <p>{new Date(rec.statement_date).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="capitalize">{rec.status.replace("_", " ")}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Statement Balance</p>
            <p className="font-mono">{Number(rec.statement_ending_balance).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Book Balance</p>
            <p className="font-mono">{Number(rec.book_ending_balance).toFixed(2)}</p>
          </div>
        </div>

        {rec.status === "in_progress" && (
          <ReconciliationActions reconciliationId={id} schemaName={entity.schemaName} />
        )}
      </div>

      <h2 className="text-xl font-semibold">Reconciliation Items</h2>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Reference</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-center p-3 font-medium">Cleared</th>
            </tr>
          </thead>
          <tbody>
            {(rec.items || []).length === 0 && (
              <tr><td colSpan={4} className="text-center p-6 text-muted-foreground">No items. Upload a CSV or add manually.</td></tr>
            )}
            {(rec.items || []).map((item: any) => (
              <tr key={item.id} className="border-b">
                <td className="p-3 text-xs capitalize">{item.type.replace(/_/g, " ")}</td>
                <td className="p-3 text-xs font-mono">{item.reference || "—"}</td>
                <td className="p-3 text-right font-mono">{Number(item.amount).toFixed(2)}</td>
                <td className="p-3 text-center">{item.is_cleared ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create reconciliation actions client component**

Create `src/app/(dashboard)/bank-reconciliation/[id]/reconciliation-actions.tsx`:

```tsx
"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function ReconciliationActions({ reconciliationId, schemaName }: { reconciliationId: string; schemaName: string }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState("")
  const [error, setError] = useState("")

  async function handleUploadCSV() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setLoading("upload")
    setError("")
    try {
      const text = await file.text()
      const res = await fetch(`/api/v1/bank-reconciliation/${reconciliationId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "deposit_in_transit",
          reference: file.name,
          amount: 0,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || "Failed")
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading("")
    }
  }

  async function handleReconcile() {
    if (!confirm("Confirm reconciliation? This will create adjusting entries for bank charges, interest, and errors.")) return
    setLoading("reconcile")
    setError("")
    try {
      const res = await fetch(`/api/v1/bank-reconciliation/${reconciliationId}/reconcile`, {
        method: "POST",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || "Failed")
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading("")
    }
  }

  return (
    <div className="flex gap-2 pt-2">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleUploadCSV} />
      <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading === "upload"}>
        Upload CSV
      </Button>
      <Button onClick={handleReconcile} disabled={loading === "reconcile"}>
        {loading === "reconcile" ? "Processing..." : "Complete Reconciliation"}
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 8: Update RBAC Permissions

**Files:**
- Modify: `src/lib/auth/rbac.ts`

- [ ] **Step 1: Read existing RBAC and add new module permissions**

Read `src/lib/auth/rbac.ts`. Add `fixed_assets` and `bank_reconciliation` permissions. Follow the existing pattern in the `PERMISSIONS` map. Add these entries:

```ts
fixed_assets: {
  read: ["super_admin", "accountant", "finance_officer", "auditor"],
  create: ["super_admin", "accountant"],
  update: ["super_admin", "accountant"],
},
bank_reconciliation: {
  read: ["super_admin", "accountant", "finance_officer", "auditor"],
  create: ["super_admin", "accountant", "finance_officer"],
},
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 9: Update NavLinks Sidebar

**Files:**
- Modify: `src/components/dashboard/nav-links.tsx`

- [ ] **Step 1: Add Fixed Assets and Bank Reconciliation links**

Read `nav-links.tsx`. Find where Vendor Accounts is defined. After it, add:

```tsx
{
  name: "Fixed Assets",
  href: "/dashboard/fixed-assets",
  icon: Package,
  permission: "fixed_assets",
},
{
  name: "Bank Reconciliation",
  href: "/dashboard/bank-reconciliation",
  icon: Landmark,
  permission: "bank_reconciliation",
},
```

Import icons if not already: `import { Package, Landmark } from "lucide-react"`.

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 10: Final TypeScript Verification

- [ ] **Step 1: Run TypeScript check**

Run: `node node_modules/typescript/bin/tsc --noEmit`

Expected: zero errors. Fix any issues found, re-check, then mark complete.

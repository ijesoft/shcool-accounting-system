import { prisma } from "@/lib/db"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { journalEntryRepository } from "@/repositories/journal-entry.repository"
import { auditLog } from "@/lib/audit/audit-log"
import { depreciationEngine } from "@/lib/accounting/depreciation-engine"

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
    estimatedLifeYears: number; salvageValue?: number; depreciationMethod?: string
  }) {
    return prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".fixed_asset (asset_code, asset_name, asset_category, acquisition_date, acquisition_cost, estimated_life_years, salvage_value, depreciation_method)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8) RETURNING *`,
      data.assetCode, data.assetName, data.assetCategory,
      data.acquisitionDate, data.acquisitionCost,
      data.estimatedLifeYears, data.salvageValue || 0,
      data.depreciationMethod || "straight_line"
    ).then(r => r[0])
  },

  async update(entitySchema: string, id: string, data: {
    assetName?: string; assetCategory?: string; acquisitionCost?: number
    estimatedLifeYears?: number; salvageValue?: number; depreciationMethod?: string
  }) {
    const sets: string[] = []
    const vals: any[] = []
    let i = 1
    if (data.assetName !== undefined) { sets.push(`asset_name = $${i}`); vals.push(data.assetName); i++ }
    if (data.assetCategory !== undefined) { sets.push(`asset_category = $${i}`); vals.push(data.assetCategory); i++ }
    if (data.acquisitionCost !== undefined) { sets.push(`acquisition_cost = $${i}`); vals.push(data.acquisitionCost); i++ }
    if (data.estimatedLifeYears !== undefined) { sets.push(`estimated_life_years = $${i}`); vals.push(data.estimatedLifeYears); i++ }
    if (data.salvageValue !== undefined) { sets.push(`salvage_value = $${i}`); vals.push(data.salvageValue); i++ }
    if (data.depreciationMethod !== undefined) { sets.push(`depreciation_method = $${i}`); vals.push(data.depreciationMethod); i++ }
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

  async generateDepreciationSchedule(entitySchema: string, assetId: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".fixed_asset WHERE id = $1`, assetId
    )
    const asset = rows[0]
    if (!asset) throw new Error("Asset not found")

    const method = asset.depreciation_method || "straight_line"
    const totalMonths = Number(asset.estimated_life_years) * 12
    const schedule = depreciationEngine.generateSchedule(
      method,
      Number(asset.acquisition_cost),
      Number(asset.salvage_value),
      Number(asset.estimated_life_years),
      asset.acquisition_date,
      totalMonths
    )
    return {
      assetId: asset.id,
      assetCode: asset.asset_code,
      assetName: asset.asset_name,
      method,
      acquisitionCost: Number(asset.acquisition_cost),
      salvageValue: Number(asset.salvage_value),
      usefulLifeYears: Number(asset.estimated_life_years),
      lines: schedule.lines,
    }
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

    const method = asset.depreciation_method || "straight_line"
    const remainingMonths = (Number(asset.estimated_life_years) * 12) - Math.round(accumulated / (depreciableBase / (Number(asset.estimated_life_years) * 12)))
    const schedule = depreciationEngine.generateSchedule(
      method,
      Number(asset.acquisition_cost),
      Number(asset.salvage_value),
      Number(asset.estimated_life_years),
      asset.acquisition_date,
      remainingMonths
    )
    const currentPeriodIndex = schedule.lines.findIndex(l => l.periodDate === new Date().toISOString().split("T")[0])
    const line = currentPeriodIndex >= 0 ? schedule.lines[currentPeriodIndex] : schedule.lines[0]
    if (!line) throw new Error("No depreciation schedule available")
    const depAmount = line.depreciationAmount

    const accounts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, account_code FROM "${entitySchema}".account WHERE account_code IN ($1, $2)`,
      "51400",
      asset.asset_category === "building" ? "12130" : "12150"
    )
    const depExpenseId = accounts.find((a: any) => a.account_code === "51400")?.id
    const accumCode = asset.asset_category === "building" ? "12130" : "12150"
    const accumId = accounts.find((a: any) => a.account_code === accumCode)?.id
    if (!depExpenseId || !accumId) throw new Error("Required accounts not found")

    const entry = await journalEntryRepository.create(entitySchema, {
      entryDate: new Date().toISOString().split("T")[0],
      sourceModule: "DR",
      description: `Depreciation - ${asset.asset_name} (${asset.asset_code})`,
      createdBy: userId,
      lines: [
        { accountId: depExpenseId, debit: depAmount, credit: 0, lineOrder: 1 },
        { accountId: accumId, debit: 0, credit: depAmount, lineOrder: 2 },
      ],
    })

    const result = await postingEngine.post(
      entitySchema, entry!.id, userId,
      new Date().toISOString().split("T")[0],
      entry!.lines.map((l: any) => ({
        accountId: l.account_id,
        debit: Number(l.debit),
        credit: Number(l.credit),
      }))
    )
    if (!result.success) {
      throw new Error(result.errors.map(e => e.message).join("; "))
    }

    await prisma.$queryRawUnsafe(
      `INSERT INTO "${entitySchema}".depreciation_entry (fixed_asset_id, fiscal_period_id, depreciation_amount, journal_entry_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (fixed_asset_id, fiscal_period_id) DO NOTHING`,
      assetId, fiscalPeriodId, depAmount, entry!.id
    )

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".fixed_asset
       SET accumulated_depreciation = accumulated_depreciation + $1,
           status = CASE WHEN accumulated_depreciation + $1 >= $2 THEN 'fully_depreciated' ELSE 'active' END
       WHERE id = $3`,
      depAmount, depreciableBase, assetId
    )

    const entityRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public.entity WHERE schema_name = $1`, entitySchema
    )
    if (entityRows[0]) {
      await auditLog.record({
        entityId: entityRows[0].id,
        userId,
        action: "post",
        tableName: "depreciation",
        recordId: assetId,
        newValues: { depreciation_amount: depAmount, asset_name: asset.asset_name },
      })
    }

    return { journalEntry: entry, depreciationAmount: depAmount }
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

    const lines: { accountId: string; debit: number; credit: number; lineOrder: number }[] = []

    if (gainLoss > 0) {
      lines.push({ accountId: assetAccountId, debit: 0, credit: cost, lineOrder: 1 })
      lines.push({ accountId: accumId, debit: accumDep, credit: 0, lineOrder: 2 })
      if (gainId) lines.push({ accountId: gainId, debit: 0, credit: gainLoss, lineOrder: 3 })
    } else {
      lines.push({ accountId: assetAccountId, debit: 0, credit: cost, lineOrder: 1 })
      lines.push({ accountId: accumId, debit: accumDep, credit: 0, lineOrder: 2 })
      if (lossId) lines.push({ accountId: lossId, debit: Math.abs(gainLoss), credit: 0, lineOrder: 3 })
    }

    const entry = await journalEntryRepository.create(entitySchema, {
      entryDate: disposalDate,
      sourceModule: "FA",
      description: `Disposal - ${asset.asset_name} (${asset.asset_code})`,
      createdBy: userId,
      lines,
    })

    const result = await postingEngine.post(
      entitySchema, entry!.id, userId, disposalDate,
      entry!.lines.map((l: any) => ({
        accountId: l.account_id,
        debit: Number(l.debit),
        credit: Number(l.credit),
      }))
    )
    if (!result.success) {
      throw new Error(result.errors.map(e => e.message).join("; "))
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".fixed_asset
       SET status = 'disposed', disposal_date = $1::date, disposal_amount = $2, journal_entry_id = $3
       WHERE id = $4`,
      disposalDate, disposalAmount, entry!.id, assetId
    )

    const entityRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public.entity WHERE schema_name = $1`, entitySchema
    )
    if (entityRows[0]) {
      await auditLog.record({
        entityId: entityRows[0].id,
        userId,
        action: "post",
        tableName: "fixed_asset_disposal",
        recordId: assetId,
        newValues: { disposal_amount: disposalAmount, asset_name: asset.asset_name },
      })
    }

    return { journalEntry: entry, gainLoss }
  },
}

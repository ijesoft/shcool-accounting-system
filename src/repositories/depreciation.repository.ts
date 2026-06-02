import { prisma } from "@/lib/db"

export const depreciationRepository = {
  async getSchedules(entitySchema: string, fiscalPeriodId: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT de.*, fa.asset_code, fa.asset_name, fa.depreciation_method
       FROM "${entitySchema}".depreciation_entry de
       JOIN "${entitySchema}".fixed_asset fa ON fa.id = de.fixed_asset_id
       WHERE de.fiscal_period_id = $1::uuid
       ORDER BY fa.asset_code`,
      fiscalPeriodId
    )
  },

  async hasDepreciationForPeriod(entitySchema: string, assetId: string, fiscalPeriodId: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as count FROM "${entitySchema}".depreciation_entry
       WHERE fixed_asset_id = $1::uuid AND fiscal_period_id = $2::uuid`,
      assetId, fiscalPeriodId
    )
    return Number(rows[0]?.count || 0) > 0
  },

  async bulkDepreciate(
    entitySchema: string,
    fiscalPeriodId: string,
    entries: {
      fixedAssetId: string
      depreciationAmount: number
      journalEntryId: string
    }[]
  ) {
    for (const entry of entries) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO "${entitySchema}".depreciation_entry 
         (fixed_asset_id, fiscal_period_id, depreciation_amount, journal_entry_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (fixed_asset_id, fiscal_period_id) DO NOTHING`,
        entry.fixedAssetId, fiscalPeriodId, entry.depreciationAmount, entry.journalEntryId
      )
    }
  },
}

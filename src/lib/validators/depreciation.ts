import { z } from "zod"

export const createFixedAssetSchema = z.object({
  assetTag: z.string().max(30),
  description: z.string().max(500),
  category: z.string().max(100),
  acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acquisitionCost: z.number().min(0.01),
  usefulLife: z.number().int().min(1),
  salvageValue: z.number().min(0).default(0),
  depreciationMethod: z.enum(["straight_line", "declining_balance", "sum_of_years"]).default("straight_line"),
})

export const depreciateAssetSchema = z.object({
  fiscalPeriodId: z.string().uuid(),
  totalPeriods: z.number().int().min(1).max(360),
})

export const disposeAssetSchema = z.object({
  disposalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  disposalAmount: z.number().min(0),
})

export type CreateFixedAssetInput = z.infer<typeof createFixedAssetSchema>
export type DepreciateAssetInput = z.infer<typeof depreciateAssetSchema>
export type DisposeAssetInput = z.infer<typeof disposeAssetSchema>

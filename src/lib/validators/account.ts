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
  level: z.number().int().min(0).max(5).default(3),
  description: z.string().optional(),
})

export const updateAccountSchema = z.object({
  accountName: z.string().min(2).max(200).optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
})

export type CreateAccountInput = z.infer<typeof createAccountSchema>
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>

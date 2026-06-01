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

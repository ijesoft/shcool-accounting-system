import { z } from "zod"

export const journalEntryLineSchema = z.object({
  accountId: z.string().uuid("Account must be a valid UUID"),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  lineDescription: z.string().optional(),
  lineOrder: z.number().int().min(0),
  partyType: z.enum(["student", "vendor", "employee"]).optional(),
  partyId: z.string().uuid().optional(),
}).refine(
  (data) => data.debit > 0 || data.credit > 0,
  { message: "Each line must have either a debit or credit amount" }
).refine(
  (data) => (data.partyType == null) === (data.partyId == null),
  { message: "partyType and partyId must both be set or both be empty" }
)

export const createJournalEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date (YYYY-MM-DD)"),
  reference: z.string().max(50).optional(),
  sourceModule: z.enum(["JE", "AR", "AP", "CM", "CD", "FA", "BR"]).default("JE"),
  description: z.string().optional(),
  lines: z.array(journalEntryLineSchema).min(2, "Journal entry must have at least 2 lines"),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0)
    return Math.abs(totalDebit - totalCredit) < 0.01
  },
  { message: "Total debits must equal total credits" }
)

export const updateJournalEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reference: z.string().max(50).optional(),
  description: z.string().optional(),
  lines: z.array(journalEntryLineSchema).min(2).optional(),
}).refine(
  (data) => {
    if (!data.lines) return true
    const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0)
    return Math.abs(totalDebit - totalCredit) < 0.01
  },
  { message: "Total debits must equal total credits" }
)

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>

import { z } from "zod"

export const createApprovalRuleSchema = z.object({
  module: z.enum(["JE", "CD", "AP", "AR", "FA"]),
  minAmount: z.number().min(0),
  maxAmount: z.number().min(0).optional().nullable(),
  approverRoles: z.array(z.string().uuid()).min(1),
})

export const approveEntrySchema = z.object({
  comments: z.string().max(500).optional(),
})

export const rejectEntrySchema = z.object({
  reason: z.string().min(1).max(500),
})

export type CreateApprovalRuleInput = z.infer<typeof createApprovalRuleSchema>
export type ApproveEntryInput = z.infer<typeof approveEntrySchema>
export type RejectEntryInput = z.infer<typeof rejectEntrySchema>

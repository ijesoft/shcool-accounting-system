import { journalEntryRepository } from "@/repositories/journal-entry.repository"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { approvalService } from "@/services/approval.service"
import { prisma } from "@/lib/db"
import type { CreateJournalEntryInput, UpdateJournalEntryInput } from "@/lib/validators/journal-entry"

async function validateParties(
  entitySchema: string,
  lines: { accountId: string; partyType?: string; partyId?: string; lineOrder: number }[]
) {
  if (lines.length === 0) return

  const accountIds = [...new Set(lines.map((l) => l.accountId))]
  const placeholders = accountIds.map((_, i) => `$${i + 1}::uuid`).join(",")
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; account_code: string; subledger_type: string | null }>>(
    `SELECT id::text as id, account_code, subledger_type
     FROM "${entitySchema}".account WHERE id IN (${placeholders})`,
    ...accountIds
  )
  const accountById = new Map(rows.map((a) => [a.id, a]))

  for (const line of lines) {
    const acc = accountById.get(line.accountId)
    if (!acc) {
      throw { status: 400, code: "ERR_VALIDATION", message: `Line ${line.lineOrder + 1}: account not found` }
    }

    if (acc.subledger_type) {
      if (!line.partyId || !line.partyType) {
        throw {
          status: 400,
          code: "ERR_VALIDATION",
          message: `Line ${line.lineOrder + 1}: account ${acc.account_code} requires a ${acc.subledger_type} party`,
        }
      }
      if (line.partyType !== acc.subledger_type) {
        throw {
          status: 400,
          code: "ERR_VALIDATION",
          message: `Line ${line.lineOrder + 1}: account ${acc.account_code} expects ${acc.subledger_type} but got ${line.partyType}`,
        }
      }
    } else if (line.partyId || line.partyType) {
      throw {
        status: 400,
        code: "ERR_VALIDATION",
        message: `Line ${line.lineOrder + 1}: account ${acc.account_code} is not a subledger account; cannot have a party`,
      }
    }
  }
}

export const journalEntryService = {
  async list(entitySchema: string) {
    return journalEntryRepository.findAll(entitySchema)
  },

  async getById(entitySchema: string, id: string) {
    return journalEntryRepository.findById(entitySchema, id)
  },

  async create(entitySchema: string, input: CreateJournalEntryInput, userId: string) {
    const errors = await postingEngine.validate(entitySchema, { lines: input.lines })
    if (errors.length > 0) {
      throw { status: 400, code: "ERR_VALIDATION", message: errors.map(e => e.message).join("; ") }
    }

    await validateParties(entitySchema, input.lines as any)

    return journalEntryRepository.create(entitySchema, {
      entryDate: input.entryDate,
      reference: input.reference,
      sourceModule: input.sourceModule,
      description: input.description,
      createdBy: userId,
      lines: input.lines.map((l, i) => ({
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        lineDescription: l.lineDescription,
        lineOrder: l.lineOrder,
        partyType: l.partyType,
        partyId: l.partyId,
      })),
    })
  },

  async update(entitySchema: string, id: string, input: UpdateJournalEntryInput) {
    const entry = await journalEntryRepository.findById(entitySchema, id)
    if (!entry) throw { status: 404, code: "ERR_NOT_FOUND", message: "Journal entry not found" }
    if (entry.status !== "draft") throw { status: 400, code: "ERR_ENTRY_ALREADY_POSTED", message: "Cannot modify a posted entry" }

    if (input.lines) {
      const errors = await postingEngine.validate(entitySchema, { lines: input.lines })
      if (errors.length > 0) {
        throw { status: 400, code: "ERR_VALIDATION", message: errors.map(e => e.message).join("; ") }
      }
      await validateParties(entitySchema, input.lines as any)
    }

    return journalEntryRepository.update(entitySchema, id, {
      ...input,
      lines: input.lines?.map((l, i) => ({
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        lineDescription: l.lineDescription,
        lineOrder: l.lineOrder,
        partyType: l.partyType,
        partyId: l.partyId,
      })),
    })
  },

  async post(entitySchema: string, id: string, userId: string) {
    const entry = await journalEntryRepository.findById(entitySchema, id)
    if (!entry) throw { status: 404, code: "ERR_NOT_FOUND", message: "Journal entry not found" }
    if (entry.status !== "approved") throw { status: 400, code: "ERR_ENTRY_NOT_APPROVED", message: "Entry must be approved before posting" }

    const result = await postingEngine.post(
      entitySchema, id, userId, entry.entry_date.toISOString().split('T')[0], entry.lines
    )

    if (!result.success) {
      throw { status: 400, code: result.errors[0].code, message: result.errors.map(e => e.message).join("; ") }
    }

    return journalEntryRepository.findById(entitySchema, id)
  },

  async reverse(entitySchema: string, id: string, userId: string) {
    const entry = await journalEntryRepository.findById(entitySchema, id)
    if (!entry) throw { status: 404, code: "ERR_NOT_FOUND", message: "Journal entry not found" }

    const result = await postingEngine.reverse(entitySchema, id, userId)
    if (!result.success) {
      throw { status: 400, code: result.errors[0].code, message: result.errors.map(e => e.message).join("; ") }
    }

    return journalEntryRepository.findById(entitySchema, id)
  },

  async submitForApproval(entitySchema: string, id: string, userId: string) {
    const entry = await journalEntryRepository.findById(entitySchema, id)
    if (!entry) throw { status: 404, code: "ERR_NOT_FOUND", message: "Journal entry not found" }
    if (entry.status !== "draft") throw { status: 400, code: "ERR_INVALID_STATUS", message: "Only draft entries can be submitted" }

    await approvalService.submitForApproval(entitySchema, id, userId)
    return journalEntryRepository.findById(entitySchema, id)
  },

  async approve(entitySchema: string, id: string, userId: string, comments?: string) {
    const entry = await journalEntryRepository.findById(entitySchema, id)
    if (!entry) throw { status: 404, message: "Journal entry not found" }
    if (entry.status !== "pending_approval") throw { status: 400, message: "Entry not pending approval" }

    await approvalService.approve(entitySchema, id, userId, comments)
    return journalEntryRepository.findById(entitySchema, id)
  },

  async reject(entitySchema: string, id: string, userId: string, reason: string) {
    const entry = await journalEntryRepository.findById(entitySchema, id)
    if (!entry) throw { status: 404, message: "Journal entry not found" }
    if (entry.status !== "pending_approval") throw { status: 400, message: "Entry not pending approval" }

    await approvalService.reject(entitySchema, id, userId, reason)
    return journalEntryRepository.findById(entitySchema, id)
  },
}

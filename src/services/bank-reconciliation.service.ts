import { prisma } from "@/lib/db"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { journalEntryRepository } from "@/repositories/journal-entry.repository"
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

  async autoMatch(entitySchema: string, reconciliationId: string) {
    const recs = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".bank_reconciliation WHERE id = $1`, reconciliationId
    )
    if (!recs[0]) throw new Error("Reconciliation not found")

    const statementItems = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".reconciliation_item
       WHERE reconciliation_id = $1 AND is_cleared = FALSE AND type IN ('deposit_in_transit', 'outstanding_check')`,
      reconciliationId
    )

    const bookItems = await prisma.$queryRawUnsafe<any[]>(
      `SELECT jel.id, jel.account_id, jel.debit, jel.credit, je.entry_date, je.entry_number
       FROM "${entitySchema}".journal_entry_line jel
       JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
       JOIN "${entitySchema}".account a ON a.id = jel.account_id
       WHERE je.status = 'posted'
         AND a.account_code = '11120'
         AND je.entry_date <= (SELECT statement_date FROM "${entitySchema}".bank_reconciliation WHERE id = $1)` as any,
      reconciliationId
    )

    const matchedStatementIds: string[] = []
    const matchedBookIds: string[] = []

    for (const stmt of statementItems) {
      const stmtAmount = Number(stmt.amount)
      const matched = bookItems.find((book: any) => {
        if (matchedBookIds.includes(book.id)) return false
        const bookAmount = Number(book.debit) + Number(book.credit)
        return Math.abs(bookAmount - stmtAmount) < 0.01
      })
      if (matched) {
        matchedStatementIds.push(stmt.id)
        matchedBookIds.push(matched.id)
      }
    }

    if (matchedStatementIds.length > 0) {
      const placeholders = matchedStatementIds.map((_, i) => `$${i + 1}`).join(",")
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".reconciliation_item SET is_cleared = TRUE WHERE id IN (${placeholders})`,
        ...matchedStatementIds
      )
    }

    return { matchedCount: matchedStatementIds.length }
  },

  async getSummary(entitySchema: string, reconciliationId: string) {
    const recs = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".bank_reconciliation WHERE id = $1`, reconciliationId
    )
    if (!recs[0]) throw new Error("Reconciliation not found")

    const items = await prisma.$queryRawUnsafe<any[]>(
      `SELECT type, COALESCE(SUM(amount), 0) as total
       FROM "${entitySchema}".reconciliation_item
       WHERE reconciliation_id = $1
       GROUP BY type`, reconciliationId
    )

    const getAmount = (type: string) => Number(items.find((i: any) => i.type === type)?.total || 0)

    const outstandingChecks = getAmount("outstanding_check")
    const depositsInTransit = getAmount("deposit_in_transit")
    const bankCharges = getAmount("bank_charge")
    const interest = getAmount("interest")
    const nsf = getAmount("nsf")
    const bankErrors = getAmount("bank_error")
    const bookErrors = getAmount("book_error")

    const statementBalance = Number(recs[0].statement_ending_balance)
    const bookBalance = Number(recs[0].book_ending_balance)

    const adjustedBankBalance = statementBalance + depositsInTransit - outstandingChecks + bankErrors
    const adjustedBookBalance = bookBalance - bankCharges + interest - nsf - bookErrors

    return {
      statementBalance,
      bookBalance,
      outstandingChecks,
      depositsInTransit,
      bankCharges,
      interest,
      nsf,
      bankErrors,
      bookErrors,
      adjustedBankBalance,
      adjustedBookBalance,
      balanced: Math.abs(adjustedBankBalance - adjustedBookBalance) < 0.01,
    }
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

    const adjItems = items.filter((i: any) =>
      ["bank_charge", "interest", "nsf", "bank_error", "book_error"].includes(i.type)
    )

    if (adjItems.length > 0) {
      const allCodes = adjItems.flatMap((i: any) => {
        switch (i.type) {
          case "bank_charge": return ["51800", "11120"]
          case "interest": return ["11120", "41400"]
          case "nsf": return ["11200", "11120"]
          default: return ["51800", "11120"]
        }
      })
      const uniqueCodes = Array.from(new Set(allCodes))
      const placeholders = uniqueCodes.map((_, idx) => `$${idx + 1}`).join(", ")
      const accounts = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, account_code FROM "${entitySchema}".account WHERE account_code IN (${placeholders})`,
        ...uniqueCodes
      )
      const accountMap = new Map(accounts.map((a: any) => [a.account_code, a.id]))

      const cashBankId = accountMap.get("11120")
      if (!cashBankId) throw new Error("Cash in Bank account (11120) not found")

      for (const item of adjItems) {
        if (item.journal_entry_id) continue

        let debitCode: string
        let creditCode: string
        switch (item.type) {
          case "bank_charge":
            debitCode = "51800"; creditCode = "11120"; break
          case "interest":
            debitCode = "11120"; creditCode = "41400"; break
          case "nsf":
            debitCode = "11200"; creditCode = "11120"; break
          default:
            debitCode = "51800"; creditCode = "11120"; break
        }

        const debitAccountId = accountMap.get(debitCode)
        const creditAccountId = accountMap.get(creditCode)
        if (!debitAccountId) throw new Error(`Account ${debitCode} not found`)
        if (!creditAccountId) throw new Error(`Account ${creditCode} not found`)

        const amount = Number(item.amount)

        const entry = await journalEntryRepository.create(entitySchema, {
          entryDate: rec.statement_date.toISOString().split("T")[0],
          sourceModule: "BR",
          description: `Bank reconciliation adjustment - ${item.type} - ${rec.id}`,
          createdBy: userId,
          lines: [
            { accountId: debitAccountId, debit: amount, credit: 0, lineOrder: 1 },
            { accountId: creditAccountId, debit: 0, credit: amount, lineOrder: 2 },
          ],
        })

        const result = await postingEngine.post(
          entitySchema, entry!.id, userId,
          rec.statement_date.toISOString().split("T")[0],
          entry!.lines.map((l: any) => ({
            accountId: l.account_id,
            debit: Number(l.debit),
            credit: Number(l.credit),
          }))
        )
        if (!result.success) {
          throw new Error(result.errors.map((e: any) => e.message).join("; "))
        }

        await prisma.$queryRawUnsafe(
          `UPDATE "${entitySchema}".reconciliation_item SET journal_entry_id = $1 WHERE id = $2`,
          entry!.id, item.id
        )
      }
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".reconciliation_item SET is_cleared = TRUE WHERE reconciliation_id = $1 AND type IN ('deposit_in_transit', 'outstanding_check')`,
      reconciliationId
    )

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".bank_reconciliation SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      reconciliationId
    )

    const entityRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public.entity WHERE schema_name = $1`, entitySchema
    )
    if (entityRows[0]) {
      await auditLog.record({
        entityId: entityRows[0].id,
        userId,
        action: "post",
        tableName: "bank_reconciliation",
        recordId: reconciliationId,
        newValues: { status: "completed" },
      })
    }

    return { status: "completed" }
  },
}

import { describe, expect, it } from "vitest"
import { journalEntryLineSchema } from "./journal-entry"

describe("journalEntryLineSchema party fields", () => {
  it("accepts a line with both partyType and partyId", () => {
    const r = journalEntryLineSchema.safeParse({
      accountId: "00000000-0000-0000-0000-000000000001",
      debit: 100, credit: 0, lineOrder: 0,
      partyType: "student", partyId: "00000000-0000-0000-0000-000000000002",
    })
    expect(r.success).toBe(true)
  })

  it("accepts a line with neither partyType nor partyId", () => {
    const r = journalEntryLineSchema.safeParse({
      accountId: "00000000-0000-0000-0000-000000000001",
      debit: 100, credit: 0, lineOrder: 0,
    })
    expect(r.success).toBe(true)
  })

  it("rejects a line with only partyType", () => {
    const r = journalEntryLineSchema.safeParse({
      accountId: "00000000-0000-0000-0000-000000000001",
      debit: 100, credit: 0, lineOrder: 0,
      partyType: "student",
    })
    expect(r.success).toBe(false)
  })

  it("rejects a line with only partyId", () => {
    const r = journalEntryLineSchema.safeParse({
      accountId: "00000000-0000-0000-0000-000000000001",
      debit: 100, credit: 0, lineOrder: 0,
      partyId: "00000000-0000-0000-0000-000000000002",
    })
    expect(r.success).toBe(false)
  })

  it("rejects an invalid partyType", () => {
    const r = journalEntryLineSchema.safeParse({
      accountId: "00000000-0000-0000-0000-000000000001",
      debit: 100, credit: 0, lineOrder: 0,
      partyType: "alien", partyId: "00000000-0000-0000-0000-000000000002",
    })
    expect(r.success).toBe(false)
  })
})

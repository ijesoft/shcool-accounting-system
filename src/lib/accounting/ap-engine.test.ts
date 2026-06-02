import { describe, it, expect } from "vitest"
import { apEngine } from "./ap-engine"

describe("apEngine", () => {
  describe("buildJournalEntryLines", () => {
    it("is a callable function", () => {
      expect(typeof apEngine.buildJournalEntryLines).toBe("function")
    })
  })
})

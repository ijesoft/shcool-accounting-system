import { describe, it, expect } from "vitest"
import { approvalEngine } from "./approval-engine"

describe("approvalEngine", () => {
  describe("checkApproval", () => {
    it("is a callable function", () => {
      expect(typeof approvalEngine.checkApproval).toBe("function")
    })
  })

  describe("createApprovalRequest", () => {
    it("is a callable function", () => {
      expect(typeof approvalEngine.createApprovalRequest).toBe("function")
    })
  })
})

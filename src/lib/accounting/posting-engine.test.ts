import { describe, it, expect } from "vitest"
import { postingEngine } from "./posting-engine"

describe("postingEngine", () => {
  describe("validate", () => {
    it("is a callable function", () => {
      expect(typeof postingEngine.validate).toBe("function")
    })
  })

  describe("post", () => {
    it("is a callable function", () => {
      expect(typeof postingEngine.post).toBe("function")
    })
  })

  describe("reverse", () => {
    it("is a callable function", () => {
      expect(typeof postingEngine.reverse).toBe("function")
    })
  })
})

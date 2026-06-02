import { describe, it, expect } from "vitest"
import { periodControl } from "./period-control"

describe("periodControl", () => {
  describe("canPostToPeriod", () => {
    it("is a callable function", () => {
      expect(typeof periodControl.canPostToPeriod).toBe("function")
    })
  })

  describe("closePeriod", () => {
    it("is a callable function", () => {
      expect(typeof periodControl.closePeriod).toBe("function")
    })
  })

  describe("reopenPeriod", () => {
    it("is a callable function", () => {
      expect(typeof periodControl.reopenPeriod).toBe("function")
    })
  })
})

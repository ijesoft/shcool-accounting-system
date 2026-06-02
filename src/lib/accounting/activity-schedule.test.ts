import { describe, it, expect } from "vitest"
import { activitySchedule } from "./activity-schedule"

describe("activitySchedule", () => {
  describe("generateSchedule", () => {
    it("is a callable function", () => {
      expect(typeof activitySchedule.generateSchedule).toBe("function")
    })
  })
})

import { describe, it, expect } from "vitest"
import { afsPackage } from "./afs-package"

describe("afsPackage", () => {
  describe("generatePackage", () => {
    it("is a callable function", () => {
      expect(typeof afsPackage.generatePackage).toBe("function")
    })
  })
})

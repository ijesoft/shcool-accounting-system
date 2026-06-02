import { describe, expect, it } from "vitest"
import { parseStatements } from "./parser"

describe("parseStatements", () => {
  it("splits on ; outside strings and comments", () => {
    expect(parseStatements("-- comment\nA; B;")).toEqual(["A", "B"])
  })

  it("does not split on ; inside a single-quoted string", () => {
    expect(parseStatements("A; 'B;C'; D;")).toEqual(["A", "'B;C'", "D"])
  })

  it("handles SQL '' escape inside strings", () => {
    expect(parseStatements("A ''quoted''; B;")).toEqual(["A ''quoted''", "B"])
  })

  it("ignores ; inside block comments", () => {
    expect(parseStatements("A /* ; */ ; B;")).toEqual(["A", "B"])
  })

  it("handles E'...' escape strings", () => {
    expect(parseStatements("A E'escape \\';' B;")).toEqual(["A E'escape \\';'", "B"])
  })

  it("handles newlines and whitespace between statements", () => {
    expect(parseStatements("SELECT 1;\n\nSELECT 2;")).toEqual(["SELECT 1", "SELECT 2"])
  })

  it("returns [] for an empty file", () => {
    expect(parseStatements("")).toEqual([])
  })

  it("returns [] for a file with only line comments", () => {
    expect(parseStatements("-- only a comment\n-- nothing else\n")).toEqual([])
  })

  it("throws on an unterminated statement", () => {
    expect(() => parseStatements("CREATE TABLE foo")).toThrow(/unterminated/i)
  })
})

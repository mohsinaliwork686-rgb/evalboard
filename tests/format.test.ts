import { describe, expect, it } from "vitest"

import {
  direction,
  formatPercent,
  formatRateChange,
  formatScore,
  formatScoreChange,
  plural,
} from "@/lib/format"

describe("formatting", () => {
  it("writes scores to three places so reciprocal ranks stay apart", () => {
    expect(formatScore(1 / 3)).toBe("0.333")
    expect(formatScore(0.5)).toBe("0.500")
    expect(formatScore(0)).toBe("0.000")
    expect(formatScore(null)).toBe("–")
  })

  it("writes percentages to one place", () => {
    expect(formatPercent(37 / 45)).toBe("82.2%")
    expect(formatPercent(1)).toBe("100.0%")
    expect(formatPercent(null)).toBe("–")
  })

  it("signs a change, and never writes -0.000", () => {
    expect(formatScoreChange(0.71, 0.74)).toBe("+0.030")
    expect(formatScoreChange(0.9, 0.1)).toBe("-0.800")
    expect(formatScoreChange(0.5, 0.5)).toBe("0.000")
    // 0.1 + 0.2 is 0.30000000000000004 in floating point: against 0.3, a change of nothing, not a rise.
    expect(formatScoreChange(0.3, 0.1 + 0.2)).toBe("0.000")
    expect(formatScoreChange(0.3, 0.3 - 1e-12)).toBe("0.000")
    expect(formatScoreChange(null, 0.5)).toBe("–")
  })

  it("writes a pass rate change in points", () => {
    expect(formatRateChange(35 / 45, 37 / 45)).toBe("+4.4 pts")
    expect(formatRateChange(1, 0.5)).toBe("-50.0 pts")
    expect(formatRateChange(0.25, 0.25)).toBe("0.0 pts")
    expect(formatRateChange(0.5, null)).toBe("–")
  })

  it("agrees with the text about which way a change went", () => {
    expect(direction(0.71, 0.74)).toBe("up")
    expect(direction(0.74, 0.71)).toBe("down")
    expect(direction(0.3, 0.3 - 1e-12)).toBe("none")
    expect(direction(null, 1)).toBe("none")
  })

  it("pluralises", () => {
    expect(plural(1, "case")).toBe("1 case")
    expect(plural(0, "case")).toBe("0 cases")
    expect(plural(2, "case")).toBe("2 cases")
  })
})

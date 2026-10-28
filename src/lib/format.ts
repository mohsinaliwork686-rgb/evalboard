/**
 * How numbers are written, on the page and in the summary alike, so the two never disagree
 * about the same number.
 */

/** Scores to three places: the reciprocal ranks 0.333 and 0.5 must not both read as 0.3 or 0.5. */
export function formatScore(value: number | null): string {
  return value === null ? "–" : value.toFixed(3)
}

/** A share from 0 to 1, as a percentage: "82.2%". */
export function formatPercent(value: number | null): string {
  return value === null ? "–" : `${(value * 100).toFixed(1)}%`
}

/** The change in a score: "+0.030", "-0.800", or "0.000" when it rounds to nothing, never "-0.000". */
export function formatScoreChange(before: number | null, after: number | null): string {
  return signed(before, after, 3, "")
}

/** The change in a pass rate, in percentage points: "+4.4 pts". */
export function formatRateChange(before: number | null, after: number | null): string {
  return signed(before === null ? null : before * 100, after === null ? null : after * 100, 1, " pts")
}

/** Which way a change goes once rounded the way it is shown: a "0.000" is not an increase. */
export function direction(before: number | null, after: number | null, digits = 3): "up" | "down" | "none" {
  if (before === null || after === null) return "none"
  const difference = after - before
  if (Number(Math.abs(difference).toFixed(digits)) === 0) return "none"
  return difference > 0 ? "up" : "down"
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

function signed(before: number | null, after: number | null, digits: number, unit: string): string {
  if (before === null || after === null) return "–"
  const magnitude = Math.abs(after - before).toFixed(digits)
  const way = direction(before, after, digits)
  return `${way === "up" ? "+" : way === "down" ? "-" : ""}${magnitude}${unit}`
}

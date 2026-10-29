import type { ChangeClass, Comparison } from "./diff"

/**
 * What the movement chart plots: one bar per case that is in both runs, its height the change in
 * score, sorted from the biggest drop to the biggest gain. Sorted, a cluster of collapses shows
 * up as one block at the left edge instead of being scattered among the gains.
 */

export interface ChartPoint {
  id: string
  change: ChangeClass
  delta: number
  before: number
  after: number
}

export function chartPoints(comparison: Comparison): ChartPoint[] {
  const points: ChartPoint[] = []
  for (const item of comparison.cases) {
    if (item.delta === null || !item.baseline || !item.candidate) continue
    points.push({
      id: item.id,
      change: item.change,
      delta: item.delta,
      before: item.baseline.score,
      after: item.candidate.score,
    })
  }
  return points.sort((a, b) => a.delta - b.delta || a.id.localeCompare(b.id, undefined, { numeric: true }))
}

/**
 * The y-axis runs from minus this to plus this. Symmetric, so a drop and a gain of the same size
 * are the same height; rounded up to a quarter, so the ticks land on readable numbers.
 */
export function axisLimit(points: ChartPoint[]): number {
  const largest = Math.max(0, ...points.map((point) => Math.abs(point.delta)))
  return Math.min(1, Math.max(0.25, Math.ceil(largest / 0.25 - 1e-9) * 0.25))
}

export function axisTicks(limit: number): number[] {
  return [-limit, -limit / 2, 0, limit / 2, limit]
}

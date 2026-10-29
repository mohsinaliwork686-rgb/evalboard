import { describe, expect, it } from "vitest"

import { axisLimit, axisTicks, chartPoints, type ChartPoint } from "@/lib/chart"
import { compare } from "@/lib/diff"
import type { Run } from "@/lib/schema"

function run(id: string, cases: Array<[string, number]>): Run {
  return { id, cases: cases.map(([caseId, score]) => ({ id: caseId, score, tags: [] })) }
}

function point(delta: number): ChartPoint {
  return { id: "x", change: "better", delta, before: 0, after: 0 }
}

describe("the chart's points", () => {
  it("are the cases in both runs, from the biggest drop to the biggest gain", () => {
    const result = compare(
      run("x", [["small-gain", 0.5], ["collapse", 0.9], ["gone", 1], ["same", 0.4], ["big-gain", 0]]),
      run("y", [["small-gain", 0.6], ["collapse", 0.1], ["new", 1], ["same", 0.4], ["big-gain", 1]]),
    )
    const points = chartPoints(result)
    expect(points.map((item) => item.id)).toEqual(["collapse", "same", "small-gain", "big-gain"])
    expect(points[0]).toEqual({ id: "collapse", change: "regressed", delta: 0.1 - 0.9, before: 0.9, after: 0.1 })
  })

  it("break ties by id the way people count", () => {
    const cases: Array<[string, number]> = [["q10", 0], ["q2", 0], ["q1", 0]]
    const points = chartPoints(compare(run("x", cases), run("y", cases.map(([id]) => [id, 1]))))
    expect(points.map((item) => item.id)).toEqual(["q1", "q2", "q10"])
  })

  it("are empty when the runs share no case", () => {
    expect(chartPoints(compare(run("x", [["a", 1]]), run("y", [["b", 1]])))).toEqual([])
  })
})

describe("the axis", () => {
  it("is symmetric and rounded up to a quarter", () => {
    expect(axisLimit([point(-0.8), point(0.24)])).toBe(1)
    expect(axisLimit([point(0.667)])).toBe(0.75)
    expect(axisLimit([point(-0.3)])).toBe(0.5)
    expect(axisLimit([point(0.5)])).toBe(0.5)
  })

  it("never shrinks below a quarter, so tiny changes are not blown up to look huge", () => {
    expect(axisLimit([point(0.01)])).toBe(0.25)
    expect(axisLimit([point(0)])).toBe(0.25)
    expect(axisLimit([])).toBe(0.25)
  })

  it("has five ticks with zero in the middle", () => {
    expect(axisTicks(0.5)).toEqual([-0.5, -0.25, 0, 0.25, 0.5])
  })
})

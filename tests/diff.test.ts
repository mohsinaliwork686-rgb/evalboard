import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { CLASS_ORDER, compare, type ChangeClass, type Comparison } from "@/lib/diff"
import { parseResults, type Case, type Run } from "@/lib/schema"

function run(id: string, cases: Array<[string, number] | Case>): Run {
  return {
    id,
    cases: cases.map((item) => (Array.isArray(item) ? { id: item[0], score: item[1], tags: [] } : item)),
  }
}

/** Each case id with its class, in the order the comparison lists them. */
function classes(result: Comparison): Array<[string, ChangeClass]> {
  return result.cases.map((item) => [item.id, item.change])
}

describe("classifying cases", () => {
  it("finds nothing but unchanged in identical runs", () => {
    const cases: Array<[string, number]> = [["a", 1], ["b", 0.5], ["c", 0.2], ["d", 0]]
    const result = compare(run("x", cases), run("y", cases))
    expect(result.cases.every((item) => item.change === "unchanged" && item.delta === 0)).toBe(true)
    expect(result.counts).toEqual({ regressed: 0, fixed: 0, worse: 0, better: 0, unchanged: 4, removed: 0, added: 0 })
  })

  it("catches a case that flips each way", () => {
    const result = compare(run("x", [["down", 0.9], ["up", 0.1]]), run("y", [["down", 0.1], ["up", 0.9]]))
    expect(classes(result)).toEqual([
      ["down", "regressed"],
      ["up", "fixed"],
    ])
    expect(result.cases[0].delta).toBeCloseTo(-0.8)
    expect(result.cases[1].delta).toBeCloseTo(0.8)
  })

  it("tells worse and better apart from regressed and fixed", () => {
    const result = compare(
      run("x", [["passing-dips", 1], ["failing-dips", 0.4], ["passing-rises", 0.6], ["failing-rises", 0]]),
      run("y", [["passing-dips", 0.5], ["failing-dips", 0], ["passing-rises", 1], ["failing-rises", 0.3]]),
    )
    expect(Object.fromEntries(classes(result))).toEqual({
      "passing-dips": "worse",
      "failing-dips": "worse",
      "passing-rises": "better",
      "failing-rises": "better",
    })
  })

  it("matches cases by id, not by position", () => {
    // The candidate has one case added at the front. Matching by position would compare
    // every case with its neighbour and call all of them changed.
    const before = run("x", [["a", 1], ["b", 0], ["c", 0.5]])
    const after = run("y", [["new", 1], ["a", 1], ["b", 0], ["c", 0.5]])
    const result = compare(before, after)
    expect(result.counts.unchanged).toBe(3)
    expect(result.counts.added).toBe(1)
  })

  it("handles cases that are in only one run", () => {
    const result = compare(run("x", [["kept", 1], ["gone", 1]]), run("y", [["kept", 1], ["new", 0]]))
    expect(classes(result)).toEqual([
      ["kept", "unchanged"],
      ["gone", "removed"],
      ["new", "added"],
    ])
    const gone = result.cases[1]
    expect(gone.candidate).toBeUndefined()
    expect(gone.delta).toBeNull()
    const added = result.cases[2]
    expect(added.baseline).toBeUndefined()
    expect(added.candidate).toEqual({ score: 0, passed: false, passedFromFile: false })
  })

  it("handles two runs with no case in common", () => {
    const result = compare(run("x", [["a", 1], ["b", 0]]), run("y", [["c", 1], ["d", 0]]))
    expect(result.counts.removed).toBe(2)
    expect(result.counts.added).toBe(2)
    expect(result.cases.every((item) => item.delta === null)).toBe(true)
  })

  it("lets a case's own passed override the threshold", () => {
    // A judge that read the answer knows better than a cut-off on its score.
    const result = compare(
      run("x", [{ id: "high-but-failed", score: 0.9, tags: [] }, { id: "low-but-passed", score: 0.2, tags: [] }]),
      run("y", [{ id: "high-but-failed", score: 0.9, tags: [], passed: false }, { id: "low-but-passed", score: 0.2, tags: [], passed: true }]),
    )
    expect(Object.fromEntries(classes(result))).toEqual({
      "high-but-failed": "regressed",
      "low-but-passed": "fixed",
    })
    const high = result.cases.find((item) => item.id === "high-but-failed")!
    expect(high.delta).toBe(0)
    expect(high.candidate).toEqual({ score: 0.9, passed: false, passedFromFile: true })
  })

  it("counts a score exactly on the threshold as a pass", () => {
    const result = compare(run("x", [["edge", 0.5], ["below", 0.49]]), run("y", [["edge", 0.49], ["below", 0.5]]))
    expect(Object.fromEntries(classes(result))).toEqual({ edge: "regressed", below: "fixed" })
  })

  it("moves the pass mark with the threshold", () => {
    const before = run("x", [["a", 0.5]])
    const after = run("y", [["a", 0.33]])
    expect(compare(before, after).cases[0].change).toBe("regressed")
    expect(compare(before, after, { threshold: 0.3 }).cases[0].change).toBe("worse")
    expect(compare(before, after, { threshold: 1 }).cases[0].change).toBe("worse")
    expect(compare(before, after, { threshold: 0 }).counts.regressed).toBe(0)
  })

  it("refuses a threshold outside 0 to 1", () => {
    const one = run("x", [["a", 1]])
    expect(() => compare(one, one, { threshold: 1.5 })).toThrow(RangeError)
    expect(() => compare(one, one, { threshold: -0.1 })).toThrow(RangeError)
    expect(() => compare(one, one, { threshold: Number.NaN })).toThrow(RangeError)
  })
})

describe("ordering", () => {
  it("lists regressions, then fixes, then the rest by how far they moved, then removed and added", () => {
    const result = compare(
      run("x", [["small-drop", 0.6], ["big-drop", 0.9], ["fix", 0], ["gain", 0.6], ["still", 1], ["regress", 1], ["gone", 1]]),
      run("y", [["small-drop", 0.5], ["big-drop", 0.55], ["fix", 1], ["gain", 0.95], ["still", 1], ["regress", 0.2], ["new", 1]]),
    )
    expect(result.cases.map((item) => item.id)).toEqual([
      "regress",
      "fix",
      "big-drop",
      "gain",
      "small-drop",
      "still",
      "gone",
      "new",
    ])
  })

  it("puts the biggest drop first among regressions", () => {
    const result = compare(run("x", [["a", 0.5], ["b", 1], ["c", 0.6]]), run("y", [["a", 0.4], ["b", 0], ["c", 0]]))
    expect(result.cases.map((item) => item.id)).toEqual(["b", "c", "a"])
  })

  it("breaks ties by id the way people count", () => {
    const cases: Array<[string, number]> = [["q10", 1], ["q2", 1], ["q1", 1]]
    expect(compare(run("x", cases), run("y", cases)).cases.map((item) => item.id)).toEqual(["q1", "q2", "q10"])
  })
})

describe("the numbers", () => {
  // Worked by hand:
  //   baseline   a 1.0 pass, b 0.5 pass, c 0.0 fail, d 0.6 pass           mean 2.1/4 = 0.525, 3 of 4 pass
  //   candidate  a 0.5 pass, b 0.0 fail, c 0.0 fail, e 1.0 pass           mean 1.5/4 = 0.375, 2 of 4 pass
  //   a worse, b regressed, c unchanged, d removed, e added
  const baseline = run("x", [
    { id: "a", score: 1, tags: ["billing"] },
    { id: "b", score: 0.5, tags: ["billing", "refunds"] },
    { id: "c", score: 0, tags: ["shipping"] },
    { id: "d", score: 0.6, tags: ["refunds"] },
  ])
  const candidate = run("y", [
    { id: "a", score: 0.5, tags: ["billing"] },
    { id: "b", score: 0, tags: ["billing"] },
    { id: "c", score: 0, tags: ["shipping"] },
    { id: "e", score: 1, tags: ["accounts"] },
  ])

  it("match the hand-worked means, pass rates and counts", () => {
    const result = compare(baseline, candidate)
    expect(result.baseline).toEqual({ cases: 4, passed: 3, meanScore: 0.525, passRate: 0.75 })
    expect(result.candidate).toEqual({ cases: 4, passed: 2, meanScore: 0.375, passRate: 0.5 })
    expect(result.counts).toEqual({ regressed: 1, fixed: 0, worse: 1, better: 0, unchanged: 1, removed: 1, added: 1 })
    expect(Object.keys(result.counts)).toEqual(CLASS_ORDER)
  })

  it("narrow to one tag, counts and numbers included", () => {
    // refunds: b (tagged in the baseline only) and d (removed).
    const result = compare(baseline, candidate, { tag: "refunds" })
    expect(result.tag).toBe("refunds")
    expect(classes(result)).toEqual([
      ["b", "regressed"],
      ["d", "removed"],
    ])
    expect(result.baseline).toEqual({ cases: 2, passed: 2, meanScore: 0.55, passRate: 1 })
    expect(result.candidate).toEqual({ cases: 1, passed: 0, meanScore: 0, passRate: 0 })
  })

  it("list every tag for the filter, whatever the filter is set to", () => {
    const tags = ["accounts", "billing", "refunds", "shipping"]
    expect(compare(baseline, candidate).allTags).toEqual(tags)
    expect(compare(baseline, candidate, { tag: "shipping" }).allTags).toEqual(tags)
  })

  it("treat an empty tag as no filter", () => {
    const result = compare(baseline, candidate, { tag: "" })
    expect(result.tag).toBeNull()
    expect(result.cases).toHaveLength(5)
  })

  it("come out empty, not as NaN, when the filter leaves a run with nothing", () => {
    const onlyNew = compare(baseline, candidate, { tag: "accounts" })
    expect(onlyNew.baseline).toEqual({ cases: 0, passed: 0, meanScore: null, passRate: null })
    expect(onlyNew.candidate.cases).toBe(1)

    const nothing = compare(baseline, candidate, { tag: "no-such-tag" })
    expect(nothing.cases).toEqual([])
    expect(nothing.baseline.meanScore).toBeNull()
    expect(nothing.candidate.passRate).toBeNull()
  })
})

describe("on the real ragsweep runs", () => {
  const parsed = parseResults(readFileSync(new URL("./fixtures/ragsweep-results.json", import.meta.url), "utf8"))
  if (!parsed.ok) throw new Error("the ragsweep fixture no longer validates")
  const find = (id: string) => parsed.file.runs.find((item) => item.id === id)!

  it("finds the regressions that doubling the chunk size hides behind a better mean", () => {
    const result = compare(find("bm25-fixed-512-64"), find("bm25-fixed-1024-64"))
    expect(result.baseline.meanScore).toBeCloseTo(0.828, 3)
    expect(result.candidate.meanScore).toBeCloseTo(0.892, 3)
    expect(result.cases.filter((item) => item.change === "regressed").map((item) => item.id)).toEqual(["q11", "q13"])
    expect(result.cases.filter((item) => item.change === "fixed").map((item) => item.id).sort()).toEqual(["q15", "q21"])
    expect(result.cases).toHaveLength(31)
  })
})

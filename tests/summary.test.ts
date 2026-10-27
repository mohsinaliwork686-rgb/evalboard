import { describe, expect, it } from "vitest"

import { compare, type Comparison } from "@/lib/diff"
import { SAMPLES } from "@/lib/samples"
import type { Run } from "@/lib/schema"
import { summarise } from "@/lib/summary"

function run(id: string, cases: Array<[string, number, string[]?]>): Run {
  return { id, cases: cases.map(([caseId, score, tags]) => ({ id: caseId, score, tags: tags ?? [] })) }
}

function summary(comparison: Comparison, limit?: number): string {
  return summarise(comparison, { baselineName: "before", candidateName: "after", limit })
}

describe("the summary of the samples", () => {
  // Written as .md files so they render on GitHub: the snapshot is also the example.
  for (const sample of SAMPLES) {
    it(`matches the snapshot for ${sample.id}`, async () => {
      const find = (id: string) => sample.file.runs.find((item) => item.id === id)!
      const markdown = summarise(compare(find(sample.baselineRun), find(sample.candidateRun)), {
        baselineName: sample.baselineRun,
        candidateName: sample.candidateRun,
      })
      await expect(markdown).toMatchFileSnapshot(`./__snapshots__/summary-${sample.id}.md`)
    })
  }
})

describe("the summary", () => {
  const before = run("x", [["refund-a", 0.9, ["refunds"]], ["refund-b", 0.8, ["refunds"]], ["ship", 0.2, ["shipping"]], ["acct", 0.6]])
  const after = run("y", [["refund-a", 0.1, ["refunds"]], ["refund-b", 0.4, ["refunds"]], ["ship", 1, ["shipping"]], ["acct", 1]])

  it("leads with the regressions and lists them by name", () => {
    // Both means are 2.5 / 4: an average that did not move at all, over two regressions.
    const markdown = summary(compare(before, after))
    expect(markdown.split("\n")[2]).toBe("**2 cases regressed**, and the mean score stayed at 0.625.")
    expect(markdown).toContain("#### Regressed (2)")
    expect(markdown).toContain("| `refund-a` | refunds | 0.900 | 0.100 | -0.800 |")
    expect(markdown).toContain("| `refund-b` | refunds | 0.800 | 0.400 | -0.400 |")
    expect(markdown).toContain("#### Fixed (1)")
  })

  it("says 'while' when the mean rose and cases still regressed", () => {
    const markdown = summary(compare(run("x", [["a", 1], ["b", 0]]), run("y", [["a", 0.4], ["b", 1]])))
    expect(markdown).toContain("**1 case regressed** while the mean score rose from 0.500 to 0.700.")
  })

  it("says so plainly when nothing regressed", () => {
    const markdown = summary(compare(run("x", [["a", 0.5]]), run("y", [["a", 0.25]]), { threshold: 0.2 }))
    expect(markdown).toContain("No case regressed, and the mean score fell from 0.500 to 0.250.")
    expect(markdown).not.toContain("#### Regressed")
  })

  it("prints the threshold, whatever it was set to", () => {
    expect(summary(compare(before, after))).toContain("at least 0.5,")
    expect(summary(compare(before, after, { threshold: 0.75 }))).toContain("at least 0.75,")
  })

  it("shows the numbers with signs and without '-0.000'", () => {
    const markdown = summary(compare(run("x", [["a", 0.1], ["b", 0.2]]), run("y", [["a", 0.2], ["b", 0.1]])))
    expect(markdown).toContain("| Mean score | 0.150 | 0.150 | 0.000 |")
    expect(markdown).toContain("| Pass rate | 0.0% (0/2) | 0.0% (0/2) | 0.0 pts |")
    const gain = summary(compare(run("x", [["a", 0.2], ["b", 0.6]]), run("y", [["a", 0.7], ["b", 0.6]])))
    expect(gain).toContain("| Pass rate | 50.0% (1/2) | 100.0% (2/2) | +50.0 pts |")
  })

  it("names the tag it was narrowed to", () => {
    const markdown = summary(compare(before, after, { tag: "refunds" }))
    expect(markdown).toContain("Only cases tagged `refunds`: 2 cases.")
    expect(markdown).not.toContain("`ship`")
  })

  it("says there is nothing to compare when the filter leaves no cases", () => {
    const markdown = summary(compare(before, after, { tag: "no-such-tag" }))
    expect(markdown).toContain("No cases to compare.")
    expect(markdown).not.toContain("| Mean score")
  })

  it("warns that the numbers cover different cases when the sets differ", () => {
    const markdown = summary(compare(run("x", [["a", 1], ["gone", 1]]), run("y", [["a", 1], ["new", 0]])))
    expect(markdown).toContain("1 removed · 1 added")
    expect(markdown).toContain("(1 only in the baseline, 1 only in the candidate)")
  })

  it("lists at most the limit and counts the rest", () => {
    const many = Array.from({ length: 7 }, (_, index): [string, number] => [`case-${index}`, 1])
    const markdown = summary(compare(run("x", many), run("y", many.map(([id]) => [id, 0]))), 3)
    expect(markdown).toContain("#### Regressed (7)")
    expect(markdown.match(/^\| `case-/gm)).toHaveLength(3)
    expect(markdown).toContain("…and 4 more.")
  })

  it("keeps a table intact when an id or tag holds Markdown", () => {
    const markdown = summary(compare(run("x", [["a|b", 1, ["x|y", "*bold*"]], ["tick`", 1]]), run("y", [["a|b", 0, []], ["tick`", 0]])))
    expect(markdown).toContain("| `a\\|b` | x\\|y, \\*bold\\* | 1.000 | 0.000 | -1.000 |")
    expect(markdown).toContain("| `` tick` `` |")
  })

  it("names both runs at the top", () => {
    const markdown = summarise(compare(before, after), { baselineName: "prompt-v1", candidateName: "prompt-v2" })
    expect(markdown.split("\n")[0]).toBe("### evalboard: `prompt-v1` → `prompt-v2`")
  })
})

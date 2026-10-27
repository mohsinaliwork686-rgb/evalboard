import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { compare } from "@/lib/diff"
import { SAMPLES, type Sample } from "@/lib/samples"
import { parseResults } from "@/lib/schema"

function pair(sample: Sample) {
  const find = (id: string) => sample.file.runs.find((run) => run.id === id)!
  return compare(find(sample.baselineRun), find(sample.candidateRun))
}

const [retrieval, prompt] = SAMPLES

describe("the built-in samples", () => {
  it("have unique ids and download paths that exist", () => {
    expect(new Set(SAMPLES.map((sample) => sample.id)).size).toBe(SAMPLES.length)
    for (const sample of SAMPLES) {
      const text = readFileSync(new URL(`../public/${sample.path}`, import.meta.url), "utf8")
      expect(parseResults(text).ok).toBe(true)
    }
  })

  it("keep the retrieval sample identical to the real ragsweep runs it was cut from", () => {
    const full = parseResults(readFileSync(new URL("./fixtures/ragsweep-results.json", import.meta.url), "utf8"))
    if (!full.ok) throw new Error("the ragsweep fixture no longer validates")
    for (const run of retrieval.file.runs) {
      expect(run).toEqual(full.file.runs.find((original) => original.id === run.id))
    }
    expect(retrieval.file.fingerprint).toBe(full.file.fingerprint)
  })

  it("tell the story their descriptions promise", () => {
    const chunks = pair(retrieval)
    expect(chunks.baseline.meanScore).toBeCloseTo(0.83, 2)
    expect(chunks.candidate.meanScore).toBeCloseTo(0.89, 2)
    expect(chunks.counts.regressed).toBe(2)

    const support = pair(prompt)
    expect(support.baseline.meanScore).toBeCloseTo(0.71, 10)
    expect(support.candidate.meanScore).toBeCloseTo(0.74, 10)
    const regressed = support.cases.filter((item) => item.change === "regressed")
    expect(regressed.map((item) => item.tags)).toEqual(Array(5).fill(["refunds"]))
    for (const item of regressed) {
      expect(item.baseline?.score).toBe(0.9)
      expect(item.candidate?.score).toBe(0.1)
    }
    // Everything else improved, a little: the average went up.
    expect(support.cases.filter((item) => item.change === "fixed" || item.change === "better")).toHaveLength(40)
  })

  it("say plainly which numbers are made up", () => {
    expect(prompt.about).toMatch(/^Made-up numbers/)
    expect(retrieval.about).toMatch(/^Real runs/)
  })
})

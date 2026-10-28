import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { MAX_FILE_BYTES, defaultRunId, loadFile, type Readable } from "@/lib/load"
import { formatProblem } from "@/lib/schema"

function file(name: string, text: string, size = text.length): Readable {
  return { name, size, text: async () => text }
}

const ragsweepText = readFileSync(new URL("./fixtures/ragsweep-results.json", import.meta.url), "utf8")

describe("loading a file", () => {
  it("reads a valid file and keeps its name", async () => {
    const result = await loadFile(file("results.json", ragsweepText))
    expect(result.ok).toBe(true)
    expect(result.source).toBe("results.json")
  })

  it("reads a real browser File", async () => {
    const result = await loadFile(new File([ragsweepText], "results.json", { type: "application/json" }))
    expect(result.ok && result.file.runs).toHaveLength(54)
  })

  it("returns the validator's problems for a bad file", async () => {
    const result = await loadFile(file("bad.json", '{"schema": 1, "runs": [{"id": "r", "cases": [{"id": "a"}]}]}'))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.problems.map(formatProblem)).toEqual(['runs[0].cases[0]: missing field "score"'])
  })

  it("refuses a file that is too big without reading it", async () => {
    let read = false
    const huge: Readable = {
      name: "huge.json",
      size: MAX_FILE_BYTES + 1,
      text: async () => {
        read = true
        return "{}"
      },
    }
    const result = await loadFile(huge)
    expect(read).toBe(false)
    expect(!result.ok && result.problems.map(formatProblem)).toEqual([
      "the file is 50.1 MB, over evalboard's 50 MB limit",
    ])
  })

  it("reports a file the browser could not read", async () => {
    const broken: Readable = {
      name: "gone.json",
      size: 10,
      text: async () => {
        throw new Error("the file was moved")
      },
    }
    const result = await loadFile(broken)
    expect(!result.ok && result.problems.map(formatProblem)).toEqual(["the file could not be read: the file was moved"])
  })
})

describe("the starting runs", () => {
  it("are the first and the last, so one file of many runs compares at once", async () => {
    const result = await loadFile(file("results.json", ragsweepText))
    if (!result.ok) throw new Error("fixture did not load")
    expect(defaultRunId(result.file, "baseline")).toBe("bm25-fixed-256-0")
    expect(defaultRunId(result.file, "candidate")).toBe(result.file.runs[53].id)
  })

  it("are the same run for a file that has one", () => {
    const one = { runs: [{ id: "only", cases: [{ id: "a", score: 1, tags: [] }] }] }
    expect(defaultRunId(one, "baseline")).toBe("only")
    expect(defaultRunId(one, "candidate")).toBe("only")
  })
})

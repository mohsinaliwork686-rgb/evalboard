import { describe, expect, it } from "vitest"

import { checkCorpus } from "@/lib/corpus"
import type { ResultsFile } from "@/lib/schema"

function file(fingerprint?: string): ResultsFile {
  return { fingerprint, runs: [{ id: "r", cases: [{ id: "a", score: 1, tags: [] }] }] }
}

describe("checking the documents behind two runs", () => {
  it("passes runs over the same documents", () => {
    expect(checkCorpus(file("d53c7ae1a1b0976c"), file("d53c7ae1a1b0976c"))).toEqual({ status: "same" })
  })

  it("passes two runs from one file, which share a fingerprint by construction", () => {
    const one = file("d53c7ae1a1b0976c")
    expect(checkCorpus(one, one).status).toBe("same")
  })

  it("flags different documents and says which is which", () => {
    expect(checkCorpus(file("aaaa"), file("bbbb"))).toEqual({ status: "different", baseline: "aaaa", candidate: "bbbb" })
  })

  it("has nothing to say when either file has no fingerprint", () => {
    expect(checkCorpus(file(), file("bbbb")).status).toBe("unknown")
    expect(checkCorpus(file("aaaa"), file()).status).toBe("unknown")
    expect(checkCorpus(file(), file()).status).toBe("unknown")
  })
})

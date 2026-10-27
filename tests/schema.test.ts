import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { formatProblem, parseResults, validateResults, type ParseResult } from "@/lib/schema"

/**
 * A copy of ragsweep's examples/results.json (ragsweep commit d795684): 54 runs of 31 cases.
 * If ragsweep's format changes, this copy is what should be refreshed, and this test is what
 * says whether evalboard still reads it.
 */
const ragsweepText = readFileSync(new URL("./fixtures/ragsweep-results.json", import.meta.url), "utf8")

/** The smallest file the format allows, built fresh for each test so edits do not leak. */
function minimal(): Record<string, unknown> {
  return {
    schema: 1,
    runs: [
      {
        id: "before",
        cases: [
          { id: "a", score: 1 },
          { id: "b", score: 0 },
        ],
      },
    ],
  }
}

/** The formatted problems, or a failure if the file was accepted. */
function problemsOf(result: ParseResult): string[] {
  if (result.ok) throw new Error("expected the file to be refused, but it was accepted")
  return result.problems.map(formatProblem)
}

describe("files that are valid", () => {
  it("reads the real ragsweep example", () => {
    const result = parseResults(ragsweepText)
    if (!result.ok) throw new Error(result.problems.map(formatProblem).join("\n"))
    expect(result.file.tool).toBe("ragsweep")
    expect(result.file.fingerprint).toBe("d53c7ae1a1b0976c")
    expect(result.file.runs).toHaveLength(54)
    for (const run of result.file.runs) expect(run.cases).toHaveLength(31)
    expect(result.file.runs[0].cases[0]).toEqual({ id: "q01", score: 1, tags: ["simple"] })
  })

  it("reads a minimal hand-written file", () => {
    const result = validateResults(minimal())
    expect(result).toEqual({
      ok: true,
      file: {
        tool: undefined,
        fingerprint: undefined,
        runs: [
          {
            id: "before",
            cases: [
              { id: "a", score: 1, tags: [] },
              { id: "b", score: 0, tags: [] },
            ],
          },
        ],
      },
    })
  })

  it("keeps passed when a case has it", () => {
    const file = minimal()
    file.runs = [{ id: "r", cases: [{ id: "a", score: 0.9, passed: false }] }]
    const result = validateResults(file)
    expect(result.ok && result.file.runs[0].cases[0]).toEqual({ id: "a", score: 0.9, tags: [], passed: false })
  })

  it("treats null optional fields as not given, the way Python writes None", () => {
    const file = minimal()
    file.tool = null
    file.corpus = null
    file.runs = [{ id: "r", cases: [{ id: "a", score: 0.5, tags: null, passed: null }] }]
    const result = validateResults(file)
    expect(result.ok && result.file.runs[0].cases[0]).toEqual({ id: "a", score: 0.5, tags: [] })
  })

  it("ignores fields it does not use", () => {
    const file = minimal()
    file.labels = { questions: 2 }
    file.runs = [{ id: "r", config: { k: 5 }, cases: [{ id: "a", score: 0.5, retrieved: ["x.md"] }] }]
    expect(validateResults(file).ok).toBe(true)
  })

  it("accepts the edges of the score range", () => {
    const file = minimal()
    file.runs = [{ id: "r", cases: [{ id: "low", score: 0 }, { id: "high", score: 1 }] }]
    expect(validateResults(file).ok).toBe(true)
  })
})

describe("files that are refused", () => {
  it("says when the text is not JSON", () => {
    const [problem] = problemsOf(parseResults("{ this is not json"))
    expect(problem).toMatch(/^not JSON: /)
  })

  it("explains NaN, which Python writes and JSON forbids", () => {
    const [problem] = problemsOf(parseResults('{"schema": 1, "runs": [{"id": "r", "cases": [{"id": "a", "score": NaN}]}]}'))
    expect(problem).toMatch(/^not JSON: .*NaN or Infinity/)
  })

  it("refuses a top level that is not an object", () => {
    expect(problemsOf(parseResults("[1, 2]"))).toEqual(["expected a JSON object at the top, got a list"])
  })

  it("refuses a missing schema", () => {
    const file = minimal()
    delete file.schema
    expect(problemsOf(validateResults(file))).toEqual(['missing field "schema"'])
  })

  it("refuses another schema version outright, without looking further", () => {
    // runs is broken too, but in a schema 2 file it might mean something else, so it is not reported.
    const file = { schema: 2, runs: "whatever schema 2 puts here" }
    expect(problemsOf(validateResults(file))).toEqual(["this file is schema 2; evalboard understands schema 1"])
  })

  it("refuses a schema that is not a number", () => {
    const file = { ...minimal(), schema: "1" }
    expect(problemsOf(validateResults(file))).toEqual(['schema: expected the number 1, got a string ("1")'])
  })

  it("names a missing score by its place", () => {
    const file = minimal()
    file.runs = [{ id: "r", cases: [{ id: "a", score: 1 }, { id: "b" }] }]
    expect(problemsOf(validateResults(file))).toEqual(['runs[0].cases[1]: missing field "score"'])
  })

  it("names a score outside 0 to 1", () => {
    const file = minimal()
    file.runs = [{ id: "r", cases: [{ id: "a", score: 1.4 }, { id: "b", score: -0.1 }] }]
    expect(problemsOf(validateResults(file))).toEqual([
      "runs[0].cases[0].score: 1.4 is outside 0 to 1",
      "runs[0].cases[1].score: -0.1 is outside 0 to 1",
    ])
  })

  it("names a duplicate case id and where it was first used", () => {
    const file = minimal()
    file.runs = [{ id: "r", cases: [{ id: "a", score: 1 }, { id: "b", score: 1 }, { id: "a", score: 0 }] }]
    expect(problemsOf(validateResults(file))).toEqual(['runs[0].cases[2].id: "a" is already used by runs[0].cases[0]'])
  })

  it("names a duplicate run id", () => {
    const file = minimal()
    const run = { id: "same", cases: [{ id: "a", score: 1 }] }
    file.runs = [run, { ...run }]
    expect(problemsOf(validateResults(file))).toEqual(['runs[1].id: "same" is already used by runs[0]'])
  })

  it("allows the same case id in different runs", () => {
    const file = minimal()
    file.runs = [
      { id: "one", cases: [{ id: "a", score: 1 }] },
      { id: "two", cases: [{ id: "a", score: 0 }] },
    ]
    expect(validateResults(file).ok).toBe(true)
  })

  it("names fields of the wrong type", () => {
    const file = {
      schema: 1,
      tool: 7,
      corpus: { fingerprint: 123 },
      runs: [
        {
          id: 5,
          cases: [{ id: "a", score: "0.5", tags: "simple", passed: "yes" }, { id: "b", score: 1, tags: ["ok", 3] }],
        },
        { id: "r", cases: {} },
        "not a run",
      ],
    }
    expect(problemsOf(validateResults(file))).toEqual([
      "tool: expected a string, got a number (7)",
      "corpus.fingerprint: expected a string, got a number (123)",
      "runs[0].id: expected a string, got a number (5)",
      'runs[0].cases[0].score: expected a number, got a string ("0.5")',
      'runs[0].cases[0].tags: expected a list of strings, got a string ("simple")',
      'runs[0].cases[0].passed: expected true or false, got a string ("yes")',
      "runs[0].cases[1].tags[1]: expected a string, got a number (3)",
      "runs[1].cases: expected a list, got an object",
      'runs[2]: expected an object, got a string ("not a run")',
    ])
  })

  it("refuses missing and empty structure", () => {
    expect(problemsOf(validateResults({ schema: 1 }))).toEqual(['missing field "runs"'])
    expect(problemsOf(validateResults({ schema: 1, runs: [] }))).toEqual(["runs: the file has no runs"])
    expect(problemsOf(validateResults({ schema: 1, runs: [{ id: "r" }] }))).toEqual(['runs[0]: missing field "cases"'])
    expect(problemsOf(validateResults({ schema: 1, runs: [{ id: "r", cases: [] }] }))).toEqual([
      "runs[0].cases: the run has no cases",
    ])
    expect(problemsOf(validateResults({ schema: 1, runs: [{ id: " ", cases: [{ score: 1 }] }] }))).toEqual([
      "runs[0].id: is empty",
      'runs[0].cases[0]: missing field "id"',
    ])
  })

  it("lists every problem in a big file, not just the first", () => {
    const file = JSON.parse(ragsweepText)
    for (const run of file.runs) delete run.cases[12].score
    const problems = problemsOf(validateResults(file))
    expect(problems).toHaveLength(54)
    expect(problems[0]).toBe('runs[0].cases[12]: missing field "score"')
    expect(problems[53]).toBe('runs[53].cases[12]: missing field "score"')
  })

  it("shortens a long string in a message", () => {
    const file: Record<string, unknown> = { ...minimal(), tool: { name: "x" } }
    file.runs =[{ id: "r", cases: [{ id: "a", score: "a very long string that goes on and on" }] }]
    expect(problemsOf(validateResults(file))).toEqual([
      "tool: expected a string, got an object",
      'runs[0].cases[0].score: expected a number, got a string ("a very long string t...")',
    ])
  })
})

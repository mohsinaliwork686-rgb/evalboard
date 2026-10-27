/**
 * The results format, and a validator that says exactly what is wrong with a file.
 *
 * The format is the one `ragsweep` writes (schema 1). Only the fields evalboard uses are
 * checked; anything else in the file is ignored, so ragsweep's `retrieved`, `timing` and
 * `metrics` do no harm and any other tool can add its own fields.
 *
 * The validator never stops at the first problem. A file with a missing score in twelve
 * cases gets twelve messages, each with the place it happened, because fixing one, reloading,
 * and finding the next is the experience this exists to avoid.
 */

export const SCHEMA_VERSION = 1

export interface Case {
  id: string
  /** From 0 to 1. For a ragsweep file, the reciprocal rank of the first correct passage. */
  score: number
  /** Always a list, empty when the file had none. */
  tags: string[]
  /** The file's own verdict. When present it decides pass or fail, not the threshold. */
  passed?: boolean
}

export interface Run {
  id: string
  cases: Case[]
}

export interface ResultsFile {
  tool?: string
  /** Identifies the documents the runs were made over. Two files with different ones are not comparable. */
  fingerprint?: string
  runs: Run[]
}

/** One thing wrong with a file. `path` is empty for the file as a whole. */
export interface Problem {
  path: string
  message: string
}

export type ParseResult = { ok: true; file: ResultsFile } | { ok: false; problems: Problem[] }

/** `runs[0].cases[12]: missing field "score"`, or just the message when it is about the whole file. */
export function formatProblem(problem: Problem): string {
  return problem.path ? `${problem.path}: ${problem.message}` : problem.message
}

/** Reads the text of a results file. */
export function parseResults(text: string): ParseResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    // Python's json module writes NaN and Infinity by default, and JSON has neither. It is the
    // likeliest way a Python eval script produces a file that will not parse, so say so.
    const hint = /\b(NaN|-?Infinity)\b/.test(text)
      ? " (the file contains NaN or Infinity, which Python writes by default but JSON does not allow)"
      : ""
    return { ok: false, problems: [{ path: "", message: `not JSON: ${reason}${hint}` }] }
  }
  return validateResults(value)
}

/** Checks an already-parsed value against the format and keeps only the fields evalboard uses. */
export function validateResults(value: unknown): ParseResult {
  const problems: Problem[] = []
  const report = (path: string, message: string) => problems.push({ path, message })

  if (!isObject(value)) {
    return {
      ok: false,
      problems: [{ path: "", message: `expected a JSON object at the top, got ${kindOf(value)}` }],
    }
  }

  // A different schema is refused before anything else is looked at. Its other fields may
  // mean something else entirely, and a half-understood file shown as if it were fine is
  // worse than no file.
  if (!("schema" in value)) {
    return { ok: false, problems: [{ path: "", message: 'missing field "schema"' }] }
  }
  if (value.schema !== SCHEMA_VERSION) {
    const message =
      typeof value.schema === "number"
        ? `this file is schema ${value.schema}; evalboard understands schema ${SCHEMA_VERSION}`
        : `schema: expected the number ${SCHEMA_VERSION}, got ${kindOf(value.schema)}`
    return { ok: false, problems: [{ path: "", message }] }
  }

  const tool = optionalString(value, "tool", "", report)

  let fingerprint: string | undefined
  if (value.corpus !== undefined && value.corpus !== null) {
    if (isObject(value.corpus)) {
      fingerprint = optionalString(value.corpus, "fingerprint", "corpus", report)
    } else {
      report("corpus", `expected an object, got ${kindOf(value.corpus)}`)
    }
  }

  const runs: Run[] = []
  if (!("runs" in value)) {
    report("", 'missing field "runs"')
  } else if (!Array.isArray(value.runs)) {
    report("runs", `expected a list, got ${kindOf(value.runs)}`)
  } else if (value.runs.length === 0) {
    report("runs", "the file has no runs")
  } else {
    const seen = new Map<string, string>()
    value.runs.forEach((raw, index) => {
      const run = checkRun(raw, `runs[${index}]`, report)
      if (!run) return
      const earlier = seen.get(run.id)
      if (earlier) {
        report(`runs[${index}].id`, `"${run.id}" is already used by ${earlier}`)
      } else {
        seen.set(run.id, `runs[${index}]`)
      }
      runs.push(run)
    })
  }

  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, file: { tool, fingerprint, runs } }
}

type Report = (path: string, message: string) => void

function checkRun(raw: unknown, path: string, report: Report): Run | null {
  if (!isObject(raw)) {
    report(path, `expected an object, got ${kindOf(raw)}`)
    return null
  }
  const id = requiredId(raw, path, report)

  const cases: Case[] = []
  if (!("cases" in raw)) {
    report(path, 'missing field "cases"')
  } else if (!Array.isArray(raw.cases)) {
    report(`${path}.cases`, `expected a list, got ${kindOf(raw.cases)}`)
  } else if (raw.cases.length === 0) {
    report(`${path}.cases`, "the run has no cases")
  } else {
    const seen = new Map<string, string>()
    raw.cases.forEach((rawCase, index) => {
      const casePath = `${path}.cases[${index}]`
      const checked = checkCase(rawCase, casePath, report)
      if (!checked) return
      const earlier = seen.get(checked.id)
      if (earlier) {
        report(`${casePath}.id`, `"${checked.id}" is already used by ${earlier}`)
      } else {
        seen.set(checked.id, casePath)
      }
      cases.push(checked)
    })
  }

  return id === null ? null : { id, cases }
}

/** Returns null when the case is unusable; every reason has been reported by then. */
function checkCase(raw: unknown, path: string, report: Report): Case | null {
  if (!isObject(raw)) {
    report(path, `expected an object, got ${kindOf(raw)}`)
    return null
  }
  const id = requiredId(raw, path, report)

  let score: number | null = null
  if (!("score" in raw)) {
    report(path, 'missing field "score"')
  } else if (typeof raw.score !== "number") {
    report(`${path}.score`, `expected a number, got ${kindOf(raw.score)}`)
  } else if (raw.score < 0 || raw.score > 1) {
    report(`${path}.score`, `${raw.score} is outside 0 to 1`)
  } else {
    score = raw.score
  }

  // Optional fields: absent and null both mean "not given", since Python writes None as null.
  const tags: string[] = []
  if (raw.tags !== undefined && raw.tags !== null) {
    if (!Array.isArray(raw.tags)) {
      report(`${path}.tags`, `expected a list of strings, got ${kindOf(raw.tags)}`)
    } else {
      raw.tags.forEach((tag, index) => {
        if (typeof tag === "string") tags.push(tag)
        else report(`${path}.tags[${index}]`, `expected a string, got ${kindOf(tag)}`)
      })
    }
  }

  let passed: boolean | undefined
  if (raw.passed !== undefined && raw.passed !== null) {
    if (typeof raw.passed === "boolean") passed = raw.passed
    else report(`${path}.passed`, `expected true or false, got ${kindOf(raw.passed)}`)
  }

  if (id === null || score === null) return null
  return passed === undefined ? { id, score, tags } : { id, score, tags, passed }
}

function requiredId(raw: Record<string, unknown>, path: string, report: Report): string | null {
  if (!("id" in raw)) {
    report(path, 'missing field "id"')
    return null
  }
  if (typeof raw.id !== "string") {
    report(`${path}.id`, `expected a string, got ${kindOf(raw.id)}`)
    return null
  }
  if (raw.id.trim() === "") {
    report(`${path}.id`, "is empty")
    return null
  }
  return raw.id
}

function optionalString(
  raw: Record<string, unknown>,
  field: string,
  path: string,
  report: Report,
): string | undefined {
  const value = raw[field]
  if (value === undefined || value === null) return undefined
  if (typeof value === "string") return value
  report(path ? `${path}.${field}` : field, `expected a string, got ${kindOf(value)}`)
  return undefined
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** How a value reads in a message: "a string", "a list", "null". */
function kindOf(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "a list"
  switch (typeof value) {
    case "string":
      return `a string ("${value.length > 20 ? `${value.slice(0, 20)}...` : value}")`
    case "number":
      return `a number (${value})`
    case "boolean":
      return `${value}`
    case "object":
      return "an object"
    default:
      return typeof value
  }
}

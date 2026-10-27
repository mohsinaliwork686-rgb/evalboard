import type { Case, Run } from "./schema"

/**
 * Comparing two runs, case by case.
 *
 * One function, `compare`, turns a baseline run and a candidate run into everything the page
 * shows: each case's class and movement, the counts, and each run's numbers. If a number
 * appears on screen or in the summary, it comes from here.
 */

export const DEFAULT_THRESHOLD = 0.5

/** Every case falls into exactly one of these. */
export type ChangeClass = "regressed" | "fixed" | "worse" | "better" | "unchanged" | "removed" | "added"

/** The order the page and the summary list them in: what needs attention first. */
export const CLASS_ORDER: ChangeClass[] = ["regressed", "fixed", "worse", "better", "unchanged", "removed", "added"]

/** One case as it stood in one run. */
export interface Side {
  score: number
  passed: boolean
  /** True when `passed` came from the file rather than from the threshold. */
  passedFromFile: boolean
}

export interface CaseChange {
  id: string
  /** The tags from both runs, so a filter finds the case whichever run tagged it. */
  tags: string[]
  change: ChangeClass
  /** Absent for an added case. */
  baseline?: Side
  /** Absent for a removed case. */
  candidate?: Side
  /** Candidate score less baseline score. Null unless the case is in both runs. */
  delta: number | null
}

export interface RunNumbers {
  /** Cases in this run, after the tag filter. */
  cases: number
  passed: number
  /** Null when there are no cases to average. */
  meanScore: number | null
  passRate: number | null
}

export interface Comparison {
  threshold: number
  /** The tag the comparison was narrowed to, or null for every case. */
  tag: string | null
  /** Every tag in either run, sorted, whatever the filter. For the filter's own list. */
  allTags: string[]
  /** Sorted: regressions, then fixes, then the rest by how far they moved, then removed and added. */
  cases: CaseChange[]
  counts: Record<ChangeClass, number>
  /**
   * Each run's numbers over its own cases, the way the eval itself would report them. A
   * removed case still counts towards the baseline and an added one towards the candidate,
   * so the change in these is the change a dashboard would show, alongside which it sits.
   */
  baseline: RunNumbers
  candidate: RunNumbers
}

export interface CompareOptions {
  /** Pass mark for cases without their own `passed`. From 0 to 1; defaults to 0.5. */
  threshold?: number
  /** Narrow everything, counts and numbers included, to cases with this tag. Empty means no filter. */
  tag?: string | null
}

/**
 * Compares two runs. Cases are matched by `id`, never by position: adding one case in the middle
 * of a set must not shift every comparison after it.
 */
export function compare(baseline: Run, candidate: Run, options: CompareOptions = {}): Comparison {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD
  if (!(threshold >= 0 && threshold <= 1)) {
    throw new RangeError(`threshold must be from 0 to 1, got ${threshold}`)
  }
  const tag = options.tag ? options.tag : null

  const before = new Map(baseline.cases.map((item) => [item.id, item]))
  const after = new Map(candidate.cases.map((item) => [item.id, item]))

  const all: CaseChange[] = []
  for (const item of baseline.cases) {
    all.push(classify(item, after.get(item.id), threshold))
  }
  for (const item of candidate.cases) {
    if (!before.has(item.id)) all.push(classify(undefined, item, threshold))
  }

  const allTags = [...new Set(all.flatMap((item) => item.tags))].sort()
  const cases = (tag === null ? all : all.filter((item) => item.tags.includes(tag))).sort(byAttention)

  const counts = Object.fromEntries(CLASS_ORDER.map((name) => [name, 0])) as Record<ChangeClass, number>
  for (const item of cases) counts[item.change] += 1

  return {
    threshold,
    tag,
    allTags,
    cases,
    counts,
    baseline: numbers(cases.flatMap((item) => (item.baseline ? [item.baseline] : []))),
    candidate: numbers(cases.flatMap((item) => (item.candidate ? [item.candidate] : []))),
  }
}

function classify(before: Case | undefined, after: Case | undefined, threshold: number): CaseChange {
  const id = (before ?? after)!.id
  const tags = [...new Set([...(before?.tags ?? []), ...(after?.tags ?? [])])]
  const baseline = before && side(before, threshold)
  const candidate = after && side(after, threshold)

  if (!baseline) return { id, tags, change: "added", candidate, delta: null }
  if (!candidate) return { id, tags, change: "removed", baseline, delta: null }

  const delta = candidate.score - baseline.score
  let change: ChangeClass
  if (baseline.passed && !candidate.passed) change = "regressed"
  else if (!baseline.passed && candidate.passed) change = "fixed"
  else if (delta < 0) change = "worse"
  else if (delta > 0) change = "better"
  else change = "unchanged"
  return { id, tags, change, baseline, candidate, delta }
}

function side(item: Case, threshold: number): Side {
  if (item.passed !== undefined) return { score: item.score, passed: item.passed, passedFromFile: true }
  return { score: item.score, passed: item.score >= threshold, passedFromFile: false }
}

/**
 * Regressions first, biggest drop first. Then fixes, biggest gain first. Then everything else
 * in both runs by how far it moved, either way. Then removed and added cases, which have no
 * movement. Ties go by id, compared the way people read numbers, so "q2" comes before "q10".
 */
function byAttention(a: CaseChange, b: CaseChange): number {
  return rank(a) - rank(b) || movement(b) - movement(a) || a.id.localeCompare(b.id, undefined, { numeric: true })
}

function rank(item: CaseChange): number {
  switch (item.change) {
    case "regressed":
      return 0
    case "fixed":
      return 1
    case "removed":
      return 3
    case "added":
      return 4
    default:
      return 2
  }
}

function movement(item: CaseChange): number {
  return item.delta === null ? 0 : Math.abs(item.delta)
}

function numbers(sides: Side[]): RunNumbers {
  if (sides.length === 0) return { cases: 0, passed: 0, meanScore: null, passRate: null }
  const passed = sides.filter((item) => item.passed).length
  const total = sides.reduce((sum, item) => sum + item.score, 0)
  return { cases: sides.length, passed, meanScore: total / sides.length, passRate: passed / sides.length }
}

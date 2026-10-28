import type { CaseChange, Comparison, RunNumbers } from "./diff"
import { formatPercent, formatScore, formatScoreChange, formatRateChange, plural } from "./format"

/**
 * The Markdown summary, for pasting into a pull request.
 *
 * It leads with the regressions, not the average. A reviewer who reads one line should come
 * away knowing what got worse; the mean is there, but next to that count, never alone.
 */

export interface SummaryOptions {
  baselineName: string
  candidateName: string
  /** Most cases listed in each table; the rest are counted. Keeps a big regression pasteable. */
  limit?: number
}

export const DEFAULT_LIMIT = 50

/**
 * The one-sentence verdict, shared by the page and the summary: "5 cases regressed" followed by
 * "while the mean score rose from 0.710 to 0.740". `alarming` says whether the lead deserves weight.
 */
export interface Headline {
  lead: string
  rest: string
  alarming: boolean
}

export function headline(comparison: Comparison): Headline {
  const regressions = comparison.counts.regressed
  const { baseline, candidate } = comparison
  const lead = regressions === 0 ? "No case regressed" : `${plural(regressions, "case")} regressed`
  const alarming = regressions > 0

  if (baseline.meanScore === null || candidate.meanScore === null) return { lead, rest: ".", alarming }
  const before = formatScore(baseline.meanScore)
  const after = formatScore(candidate.meanScore)
  if (before === after) return { lead, rest: `, and the mean score stayed at ${before}.`, alarming }
  const way = candidate.meanScore > baseline.meanScore ? "rose" : "fell"
  // "while" for the case this tool exists for: the average says better, the cases say otherwise.
  const joint = alarming && way === "rose" ? " while" : ", and"
  return { lead, rest: `${joint} the mean score ${way} from ${before} to ${after}.`, alarming }
}

/** Why the means may not be like for like, when the two runs hold different cases. Null when they match. */
export function caseSetNote(comparison: Comparison): string | null {
  const { removed, added } = comparison.counts
  if (removed === 0 && added === 0) return null
  // The means are over each run's own cases. Say so when the sets differ, or a reader takes a
  // change in which cases were run for a change in how well they did.
  return (
    `The two runs do not hold the same cases (${removed} only in the baseline, ${added} only in ` +
    "the candidate), and each run's numbers include its own."
  )
}

export function summarise(comparison: Comparison, options: SummaryOptions): string {
  const limit = options.limit ?? DEFAULT_LIMIT
  const { counts, baseline, candidate } = comparison
  const regressed = comparison.cases.filter((item) => item.change === "regressed")
  const fixed = comparison.cases.filter((item) => item.change === "fixed")

  const lines = [`### evalboard: ${code(options.baselineName)} → ${code(options.candidateName)}`, ""]

  if (comparison.tag !== null) {
    lines.push(`Only cases tagged ${code(comparison.tag)}: ${plural(comparison.cases.length, "case")}.`, "")
  }

  if (comparison.cases.length === 0) {
    lines.push("No cases to compare.")
    return finish(lines)
  }

  const verdict = headline(comparison)
  lines.push(`${verdict.alarming ? `**${verdict.lead}**` : verdict.lead}${verdict.rest}`, "")
  lines.push(
    "| | Baseline | Candidate | Change |",
    "|---|---:|---:|---:|",
    `| Mean score | ${formatScore(baseline.meanScore)} | ${formatScore(candidate.meanScore)} | ${formatScoreChange(baseline.meanScore, candidate.meanScore)} |`,
    `| Pass rate | ${rate(baseline)} | ${rate(candidate)} | ${formatRateChange(baseline.passRate, candidate.passRate)} |`,
    "",
  )

  const tally = [
    `${counts.regressed} regressed`,
    `${counts.fixed} fixed`,
    `${counts.worse} worse`,
    `${counts.better} better`,
    `${counts.unchanged} unchanged`,
  ]
  if (counts.removed > 0) tally.push(`${counts.removed} removed`)
  if (counts.added > 0) tally.push(`${counts.added} added`)
  lines.push(tally.join(" · "), "")

  lines.push(
    `A case passes when its score is at least ${comparison.threshold}, unless the file gives its own \`passed\`.`,
  )
  const note = caseSetNote(comparison)
  if (note) lines.push(note)

  section(lines, "Regressed", regressed, limit)
  section(lines, "Fixed", fixed, limit)
  return finish(lines)
}

function section(lines: string[], title: string, cases: CaseChange[], limit: number) {
  if (cases.length === 0) return
  lines.push("", `#### ${title} (${cases.length})`, "")
  lines.push("| Case | Tags | Baseline | Candidate | Change |", "|---|---|---:|---:|---:|")
  for (const item of cases.slice(0, limit)) {
    const tags = item.tags.map(text).join(", ")
    const before = item.baseline?.score ?? null
    const after = item.candidate?.score ?? null
    lines.push(
      `| ${code(item.id)} | ${tags} | ${formatScore(before)} | ${formatScore(after)} | ${formatScoreChange(before, after)} |`,
    )
  }
  if (cases.length > limit) lines.push("", `…and ${cases.length - limit} more.`)
}

function finish(lines: string[]): string {
  lines.push("", "<sub>Compared with [evalboard](https://mohsinaliwork686-rgb.github.io/evalboard/).</sub>")
  return `${lines.join("\n")}\n`
}

function rate(numbers: RunNumbers): string {
  if (numbers.passRate === null) return "–"
  return `${formatPercent(numbers.passRate)} (${numbers.passed}/${numbers.cases})`
}

/** An id in a code span, safe inside a table: a pipe would end the cell, a backtick the span. */
function code(value: string): string {
  const escaped = value.replace(/\|/g, "\\|")
  return escaped.includes("`") ? `\`\` ${escaped} \`\`` : `\`${escaped}\``
}

/** Plain text, with the characters Markdown would act on escaped. */
function text(value: string): string {
  return value.replace(/[\\`*_[\]<>|#]/g, (character) => `\\${character}`)
}

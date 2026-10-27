import type { CaseChange, Comparison, RunNumbers } from "./diff"

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

  lines.push(headline(regressed.length, baseline, candidate), "")
  lines.push(
    "| | Baseline | Candidate | Change |",
    "|---|---:|---:|---:|",
    `| Mean score | ${score(baseline.meanScore)} | ${score(candidate.meanScore)} | ${change(baseline.meanScore, candidate.meanScore, 3, "")} |`,
    `| Pass rate | ${rate(baseline)} | ${rate(candidate)} | ${change(percent(baseline.passRate), percent(candidate.passRate), 1, " pts")} |`,
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
  if (counts.removed > 0 || counts.added > 0) {
    // The means are over each run's own cases. Say so when the sets differ, or a reader takes
    // a change in which cases were run for a change in how well they did.
    lines.push(
      `The two runs do not hold the same cases (${counts.removed} only in the baseline, ${counts.added} only in ` +
        "the candidate), and each run's numbers include its own.",
    )
  }

  section(lines, "Regressed", regressed, limit)
  section(lines, "Fixed", fixed, limit)
  return finish(lines)
}

function headline(regressions: number, baseline: RunNumbers, candidate: RunNumbers): string {
  const before = score(baseline.meanScore)
  const after = score(candidate.meanScore)
  const lead = regressions === 0 ? "No case regressed" : `**${plural(regressions, "case")} regressed**`

  if (baseline.meanScore === null || candidate.meanScore === null) return `${lead}.`
  if (before === after) return `${lead}, and the mean score stayed at ${before}.`
  const direction = candidate.meanScore > baseline.meanScore ? "rose" : "fell"
  // "while" for the case this tool exists for: the average says better, the cases say otherwise.
  const joint = regressions > 0 && direction === "rose" ? " while" : ", and"
  return `${lead}${joint} the mean score ${direction} from ${before} to ${after}.`
}

function section(lines: string[], title: string, cases: CaseChange[], limit: number) {
  if (cases.length === 0) return
  lines.push("", `#### ${title} (${cases.length})`, "")
  lines.push("| Case | Tags | Baseline | Candidate | Change |", "|---|---|---:|---:|---:|")
  for (const item of cases.slice(0, limit)) {
    const tags = item.tags.map(text).join(", ")
    const before = item.baseline?.score ?? null
    const after = item.candidate?.score ?? null
    lines.push(`| ${code(item.id)} | ${tags} | ${score(before)} | ${score(after)} | ${change(before, after, 3, "")} |`)
  }
  if (cases.length > limit) lines.push("", `…and ${cases.length - limit} more.`)
}

function finish(lines: string[]): string {
  lines.push("", "<sub>Compared with [evalboard](https://mohsinaliwork686-rgb.github.io/evalboard/).</sub>")
  return `${lines.join("\n")}\n`
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

function score(value: number | null): string {
  return value === null ? "–" : value.toFixed(3)
}

function percent(value: number | null): number | null {
  return value === null ? null : value * 100
}

function rate(numbers: RunNumbers): string {
  if (numbers.passRate === null) return "–"
  return `${(numbers.passRate * 100).toFixed(1)}% (${numbers.passed}/${numbers.cases})`
}

/** "+0.030", "-0.800", or "0.000" when it rounds to nothing, never "-0.000". */
function change(before: number | null, after: number | null, digits: number, unit: string): string {
  if (before === null || after === null) return "–"
  const difference = after - before
  const magnitude = Math.abs(difference).toFixed(digits)
  if (Number(magnitude) === 0) return `${magnitude}${unit}`
  return `${difference > 0 ? "+" : "-"}${magnitude}${unit}`
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

import type { Comparison, RunNumbers } from "@/lib/diff"
import {
  formatPercent,
  formatRateChange,
  formatScore,
  formatScoreChange,
  rateDirection,
  scoreDirection,
} from "@/lib/format"
import { caseSetNote, headline } from "@/lib/summary"

import { ChangeIcon } from "./ChangeIcon"
import { Delta } from "./Delta"

/**
 * The verdict and the numbers behind it.
 *
 * The regression count comes first and the mean third, never alone: the whole point is that
 * the average can rise while cases fall, so the page must not let the average be read first.
 */
export function Headline({ comparison }: { comparison: Comparison }) {
  const verdict = headline(comparison)
  const { counts, baseline, candidate } = comparison
  const note = caseSetNote(comparison)

  return (
    <section aria-label="Headline" className="space-y-3">
      <p className="text-lg text-ink" data-testid="verdict">
        {verdict.alarming ? <strong className="font-semibold">{verdict.lead}</strong> : verdict.lead}
        {verdict.rest}
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Regressed" detail="passed before, fail now">
          <span className="flex items-center gap-2">
            <ChangeIcon group="regressed" className="h-5 w-5" />
            {counts.regressed}
          </span>
        </Tile>
        <Tile label="Fixed" detail="failed before, pass now">
          <span className="flex items-center gap-2">
            <ChangeIcon group="fixed" className="h-5 w-5" />
            {counts.fixed}
          </span>
        </Tile>
        <Tile
          label="Mean score"
          detail={
            <Delta way={scoreDirection(baseline.meanScore, candidate.meanScore)}>
              {formatScoreChange(baseline.meanScore, candidate.meanScore)}
            </Delta>
          }
        >
          {formatScore(baseline.meanScore)} → {formatScore(candidate.meanScore)}
        </Tile>
        <Tile
          label={`Pass rate, at ${comparison.threshold} or above`}
          detail={
            <>
              <Delta way={rateDirection(baseline.passRate, candidate.passRate)}>
                {formatRateChange(baseline.passRate, candidate.passRate)}
              </Delta>
              <span className="text-ink-2"> · {passed(baseline)} → {passed(candidate)}</span>
            </>
          }
        >
          {formatPercent(baseline.passRate)} → {formatPercent(candidate.passRate)}
        </Tile>
      </div>

      {note ? <p className="text-sm text-ink-2">{note}</p> : null}
    </section>
  )
}

function Tile({ label, detail, children }: { label: string; detail: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-surface px-4 py-3">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink sm:text-2xl">{children}</div>
      <div className="mt-0.5 text-xs text-ink-2">{detail}</div>
    </div>
  )
}

function passed(numbers: RunNumbers): string {
  return numbers.cases === 0 ? "–" : `${numbers.passed} of ${numbers.cases}`
}

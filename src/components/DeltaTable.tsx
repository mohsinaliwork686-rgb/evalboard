"use client"

import { useState } from "react"

import type { CaseChange, Comparison, Side } from "@/lib/diff"
import { formatScore, formatScoreChange, scoreDirection } from "@/lib/format"

import { ChangeIcon, GROUPS, type GroupSpec } from "./ChangeIcon"
import { Delta } from "./Delta"

/**
 * Every case, in the order that needs attention: regressions, fixes, the rest by how far they
 * moved, then the unchanged, removed and added. The order inside each group is the diff's own.
 *
 * Unchanged cases start folded away. In a typical comparison they are most of the table, and a
 * reader scrolling past twenty-four identical rows to reach the removed cases learns nothing.
 */
export function DeltaTable({ comparison }: { comparison: Comparison }) {
  const [showUnchanged, setShowUnchanged] = useState(false)
  const groups = GROUPS.map((spec) => ({
    spec,
    cases: comparison.cases.filter((item) => spec.classes.includes(item.change)),
  })).filter((group) => group.cases.length > 0)
  const fromFile = comparison.cases.some((item) => item.baseline?.passedFromFile || item.candidate?.passedFromFile)

  if (groups.length === 0) {
    return <p className="text-sm text-ink-2">No cases to show.</p>
  }

  return (
    <div>
      <table className="w-full border-collapse text-sm" data-testid="delta-table">
        <caption className="sr-only">Every case, regressions first, with its score in both runs</caption>
        <thead>
          <tr className="border-b border-hairline text-left text-xs text-ink-3">
            <th scope="col" className="py-2 pr-3 font-normal">Case</th>
            <th scope="col" className="py-2 pr-3 text-right font-normal">Baseline</th>
            <th scope="col" className="py-2 pr-3 text-right font-normal">Candidate</th>
            <th scope="col" className="py-2 text-right font-normal">Change</th>
          </tr>
        </thead>
        {groups.map(({ spec, cases }) => {
          const folded = spec.id === "unchanged" && !showUnchanged
          return (
            <tbody key={spec.id} data-group={spec.id}>
              <GroupHeader
                spec={spec}
                count={cases.length}
                toggle={
                  spec.id === "unchanged"
                    ? { open: showUnchanged, onToggle: () => setShowUnchanged((open) => !open) }
                    : undefined
                }
              />
              {folded ? null : cases.map((item) => <Row key={item.id} item={item} />)}
            </tbody>
          )
        })}
      </table>
      {fromFile ? (
        <p className="mt-3 text-xs text-ink-2">
          † Pass or fail set by the file’s own <code className="font-mono">passed</code>, not by the threshold.
        </p>
      ) : null}
    </div>
  )
}

function GroupHeader({
  spec,
  count,
  toggle,
}: {
  spec: GroupSpec
  count: number
  toggle?: { open: boolean; onToggle: () => void }
}) {
  return (
    <tr>
      <th scope="colgroup" colSpan={4} className="pt-5 pb-2 text-left font-normal">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ChangeIcon group={spec.id} />
          <span className="font-semibold text-ink">
            {spec.label} <span className="tabular">{count}</span>
          </span>
          <span className="text-xs text-ink-2">{spec.description}</span>
          {toggle ? (
            <button
              type="button"
              aria-expanded={toggle.open}
              onClick={toggle.onToggle}
              className="rounded-md border border-[var(--border)] bg-surface px-2 py-0.5 text-xs text-ink-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {toggle.open ? "Hide" : "Show"}
            </button>
          ) : null}
        </span>
      </th>
    </tr>
  )
}

function Row({ item }: { item: CaseChange }) {
  const before = item.baseline?.score ?? null
  const after = item.candidate?.score ?? null
  return (
    <tr className="border-t border-hairline align-top" data-change={item.change}>
      <th scope="row" className="py-2 pr-3 text-left font-normal">
        <span className="font-mono text-[13px] break-words text-ink">{item.id}</span>
        {item.tags.length > 0 ? (
          <span className="mt-0.5 block text-xs text-ink-2">{item.tags.join(" · ")}</span>
        ) : null}
      </th>
      <td className="tabular py-2 pr-3 text-right whitespace-nowrap">
        <Score side={item.baseline} />
      </td>
      <td className="tabular py-2 pr-3 text-right whitespace-nowrap">
        <Score side={item.candidate} />
      </td>
      <td className="tabular py-2 text-right whitespace-nowrap">
        <Delta way={scoreDirection(before, after)}>{formatScoreChange(before, after)}</Delta>
      </td>
    </tr>
  )
}

/** A score, and on wider screens whether it passed. The group already says it on a phone. */
function Score({ side }: { side?: Side }) {
  if (!side) return <span className="text-ink-3">–</span>
  return (
    <span className="text-ink">
      {formatScore(side.score)}
      {side.passedFromFile ? <span className="text-ink-2">†</span> : null}
      <span className="ml-1.5 hidden text-xs text-ink-2 sm:inline">{side.passed ? "pass" : "fail"}</span>
    </span>
  )
}

"use client"

import type { Comparison } from "@/lib/diff"

import { ChangeIcon } from "./ChangeIcon"

/**
 * Narrow everything to one tag. Each tag shows how many cases carry it and how many of those
 * regressed, so a cluster of regressions in one category is visible before anything is clicked.
 * The counts come from the unfiltered comparison: they describe the tags, not the current view.
 */
export function TagFilter({
  all,
  tag,
  onChange,
}: {
  all: Comparison
  tag: string | null
  onChange: (tag: string | null) => void
}) {
  if (all.allTags.length === 0) return null

  const options = all.allTags.map((name) => {
    const tagged = all.cases.filter((item) => item.tags.includes(name))
    return { name, cases: tagged.length, regressed: tagged.filter((item) => item.change === "regressed").length }
  })

  return (
    <div role="group" aria-labelledby="tag-filter-label">
      <div id="tag-filter-label" className="text-xs text-ink-3">
        Tag
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <Chip pressed={tag === null} onClick={() => onChange(null)} label={`All cases, ${all.cases.length}`}>
          All <Count value={all.cases.length} />
        </Chip>
        {options.map((option) => (
          <Chip
            key={option.name}
            pressed={tag === option.name}
            onClick={() => onChange(tag === option.name ? null : option.name)}
            label={`${option.name}, ${option.cases} cases${option.regressed ? `, ${option.regressed} regressed` : ""}`}
          >
            {option.name} <Count value={option.cases} />
            {option.regressed > 0 ? (
              <span className="ml-1 inline-flex items-center gap-0.5 text-ink">
                <ChangeIcon group="regressed" className="h-3.5 w-3.5" />
                {option.regressed}
              </span>
            ) : null}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({
  pressed,
  onClick,
  label,
  children,
}: {
  pressed: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        pressed
          ? "border-ink bg-ink text-page"
          : "border-[var(--border)] bg-surface text-ink-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  )
}

function Count({ value }: { value: number }) {
  return <span className="tabular ml-1 opacity-70">{value}</span>
}

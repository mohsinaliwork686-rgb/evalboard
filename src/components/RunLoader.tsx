"use client"

import { useRef, useState } from "react"

import { formatProblem } from "@/lib/schema"

import type { Slot } from "./useSlot"

/** Problems shown before the rest are counted. A file broken in every case has thousands. */
const SHOWN_PROBLEMS = 20

/**
 * One side of the comparison: a card to drop a file on or pick one with, and what came of it.
 * `children` is shown once the file is ready (the run picker), `actions` while it is empty.
 */
export function RunLoader({
  side,
  title,
  hint,
  slot,
  onFile,
  actions,
  children,
}: {
  side: string
  title: string
  hint: string
  slot: Slot
  onFile: (file: File) => void
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <section
      aria-labelledby={`${side}-title`}
      data-testid={`${side}-loader`}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        const file = event.dataTransfer.files[0]
        if (file) onFile(file)
      }}
      className={`rounded-lg border bg-surface p-4 transition-colors ${
        dragging ? "border-accent ring-2 ring-accent" : "border-[var(--border)]"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={`${side}-title`} className="text-sm font-semibold text-ink">
          {title} <span className="font-normal text-ink-3">{hint}</span>
        </h2>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="rounded-md border border-[var(--border)] bg-page px-2.5 py-1 text-xs text-ink-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {slot.status === "empty" ? "Choose a file" : "Choose another"}
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          className="hidden"
          data-testid={`${side}-input`}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onFile(file)
            // Picking the same file again must reload it, so the input forgets it each time.
            event.target.value = ""
          }}
        />
      </div>

      <div className="mt-3">
        {slot.status === "empty" ? (
          <div className="space-y-2">
            <p className="rounded-md border border-dashed border-[var(--baseline)] px-3 py-4 text-center text-sm text-ink-2">
              Drop a results file here
            </p>
            {actions}
          </div>
        ) : null}

        {slot.status === "reading" ? (
          <p className="text-sm text-ink-2" role="status">
            Reading <span className="break-all">{slot.source}</span>…
          </p>
        ) : null}

        {slot.status === "invalid" ? <Problems source={slot.source} problems={slot.problems.map(formatProblem)} /> : null}

        {slot.status === "ready" ? (
          <div className="space-y-2">
            <p className="text-xs text-ink-3">
              From <span className="break-all text-ink-2">{slot.source}</span>
            </p>
            {children}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function Problems({ source, problems }: { source: string; problems: string[] }) {
  const hidden = problems.length - SHOWN_PROBLEMS
  return (
    <div role="alert">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <AlertIcon />
        <span>
          <span className="break-all">{source}</span> can’t be compared:{" "}
          {problems.length === 1 ? "1 problem" : `${problems.length} problems`}
        </span>
      </p>
      <ul className="mt-2 space-y-1 font-mono text-[12px] leading-relaxed text-ink-2">
        {problems.slice(0, SHOWN_PROBLEMS).map((problem, index) => (
          <li key={index} className="break-words">
            {problem}
          </li>
        ))}
      </ul>
      {hidden > 0 ? <p className="mt-2 text-xs text-ink-2">…and {hidden} more.</p> : null}
    </div>
  )
}

/** Not the regression arrow: a broken file is a different kind of bad news. */
function AlertIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden="true">
      <circle cx="8" cy="8" r="7.5" fill="var(--status-critical)" />
      <path d="M8 4.5v4M8 11v.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  )
}

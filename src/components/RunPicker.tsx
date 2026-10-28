"use client"

import type { ResultsFile } from "@/lib/schema"

/** Which run of a file to compare. A file with one run has nothing to pick, so it just says which. */
export function RunPicker({
  id,
  file,
  runId,
  onChange,
}: {
  id: string
  file: ResultsFile
  runId: string
  onChange: (runId: string) => void
}) {
  if (file.runs.length === 1) {
    return (
      <p className="text-sm text-ink-2">
        Run <span className="font-mono text-[13px] break-words text-ink">{runId}</span>
      </p>
    )
  }
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-ink-3">
        Run, of {file.runs.length} in this file
      </label>
      <select
        id={id}
        value={runId}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-md border border-[var(--border)] bg-surface px-2.5 py-2 font-mono text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {file.runs.map((run) => (
          <option key={run.id} value={run.id}>
            {run.id}
          </option>
        ))}
      </select>
    </div>
  )
}

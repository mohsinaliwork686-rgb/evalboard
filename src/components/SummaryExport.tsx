"use client"

import { useState } from "react"

/**
 * Copy the Markdown summary for a pull request. If the browser refuses the clipboard (an
 * insecure page, a denied permission), the text opens in a box to copy by hand rather than the
 * button quietly doing nothing.
 */
export function SummaryExport({ markdown }: { markdown: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle")
  const [open, setOpen] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown)
      setState("copied")
    } catch {
      setState("failed")
      setOpen(true)
    }
  }

  return (
    <section aria-labelledby="summary-title" className="rounded-lg border border-[var(--border)] bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="summary-title" className="text-sm font-semibold text-ink">
          Summary for a pull request
        </h2>
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-ink bg-ink px-2.5 py-1 text-xs text-page hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Copy as Markdown
        </button>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="rounded-md border border-[var(--border)] bg-page px-2.5 py-1 text-xs text-ink-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {open ? "Hide" : "Show"} the text
        </button>
        <span role="status" className="text-xs text-ink-2">
          {state === "copied" ? "Copied." : state === "failed" ? "The browser blocked copying; select the text below." : ""}
        </span>
      </div>
      {open ? (
        <textarea
          readOnly
          value={markdown}
          aria-label="Markdown summary"
          onFocus={(event) => event.target.select()}
          rows={Math.min(18, markdown.split("\n").length + 1)}
          className="mt-3 block w-full rounded-md border border-[var(--border)] bg-page p-3 font-mono text-[12px] leading-relaxed text-ink-2"
        />
      ) : null}
    </section>
  )
}

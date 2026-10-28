"use client"

import { useCallback, useRef, useState } from "react"

import { defaultRunId, loadFile } from "@/lib/load"
import type { Problem, ResultsFile } from "@/lib/schema"

/** One side of the comparison: nothing yet, being read, refused, or ready with a run chosen. */
export type Slot =
  | { status: "empty" }
  | { status: "reading"; source: string }
  | { status: "invalid"; source: string; problems: Problem[] }
  | { status: "ready"; source: string; file: ResultsFile; runId: string }

export type Side = "baseline" | "candidate"

export function useSlot(side: Side) {
  const [slot, setSlot] = useState<Slot>({ status: "empty" })
  // Each load takes a ticket. A big file picked first can finish reading after a small one
  // picked second; only the newest ticket may set the slot, so the older file cannot win.
  const latest = useRef(0)

  const load = useCallback(
    async (file: File) => {
      const ticket = ++latest.current
      setSlot({ status: "reading", source: file.name })
      const result = await loadFile(file)
      if (ticket !== latest.current) return
      setSlot(
        result.ok
          ? { status: "ready", source: result.source, file: result.file, runId: defaultRunId(result.file, side) }
          : { status: "invalid", source: result.source, problems: result.problems },
      )
    },
    [side],
  )

  /** Sets the slot directly (a sample, or the other side's file), cancelling any read in flight. */
  const set = useCallback((next: Slot) => {
    latest.current += 1
    setSlot(next)
  }, [])

  return { slot, load, set }
}

"use client"

import { useMemo, useState } from "react"

import { DeltaChart } from "@/components/DeltaChart"
import { DeltaTable } from "@/components/DeltaTable"
import { Headline } from "@/components/Headline"
import { RunLoader } from "@/components/RunLoader"
import { RunPicker } from "@/components/RunPicker"
import { SummaryExport } from "@/components/SummaryExport"
import { TagFilter } from "@/components/TagFilter"
import { ThresholdControl } from "@/components/ThresholdControl"
import { useSlot, type Slot } from "@/components/useSlot"
import { checkCorpus } from "@/lib/corpus"
import { DEFAULT_THRESHOLD, compare } from "@/lib/diff"
import { defaultRunId } from "@/lib/load"
import { SAMPLES, type Sample } from "@/lib/samples"
import { summarise } from "@/lib/summary"

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

const buttonClass =
  "rounded-md border border-[var(--border)] bg-surface px-2.5 py-1 text-xs text-ink-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"

export default function Page() {
  const baseline = useSlot("baseline")
  const candidate = useSlot("candidate")
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [tag, setTag] = useState<string | null>(null)
  const [sampleId, setSampleId] = useState<string | null>(null)
  // The pair of fingerprints the user chose to compare anyway. Kept as the pair, not a flag, so
  // loading any other mismatched files asks again without anything having to reset it.
  const [acceptedPair, setAcceptedPair] = useState<string | null>(null)
  const sample = SAMPLES.find((item) => item.id === sampleId) ?? null

  function loadSample(chosen: Sample) {
    const source = `${chosen.path.split("/").pop()} (sample)`
    baseline.set({ status: "ready", source, file: chosen.file, runId: chosen.baselineRun })
    candidate.set({ status: "ready", source, file: chosen.file, runId: chosen.candidateRun })
    setSampleId(chosen.id)
    setTag(null)
  }

  function loadInto(slot: ReturnType<typeof useSlot>, file: File) {
    setSampleId(null)
    setTag(null)
    slot.load(file)
  }

  function pickRun(slot: ReturnType<typeof useSlot>, runId: string) {
    if (slot.slot.status === "ready") slot.set({ ...slot.slot, runId })
  }

  // The whole comparison, for the tag counts, and the filtered one, for everything else. A tag
  // left over from other files is dropped rather than showing an empty page.
  const all = useMemo(() => {
    const before = readyRun(baseline.slot)
    const after = readyRun(candidate.slot)
    return before && after ? { before, after, comparison: compare(before, after, { threshold }) } : null
  }, [baseline.slot, candidate.slot, threshold])
  const activeTag = all && tag && all.comparison.allTags.includes(tag) ? tag : null
  const view = useMemo(
    () => (all && activeTag ? compare(all.before, all.after, { threshold, tag: activeTag }) : all?.comparison ?? null),
    [all, activeTag, threshold],
  )

  const corpus =
    baseline.slot.status === "ready" && candidate.slot.status === "ready"
      ? checkCorpus(baseline.slot.file, candidate.slot.file)
      : null
  const pair = corpus?.status === "different" ? `${corpus.baseline}|${corpus.candidate}` : null
  const blocked = pair !== null && pair !== acceptedPair

  const markdown = useMemo(() => {
    if (!view || baseline.slot.status !== "ready" || candidate.slot.status !== "ready") return ""
    // Two files can use the same run id; then only the file names tell the runs apart.
    const clash = baseline.slot.runId === candidate.slot.runId && baseline.slot.file !== candidate.slot.file
    const name = (slot: Extract<Slot, { status: "ready" }>) =>
      clash ? `${slot.source}: ${slot.runId}` : slot.runId
    return summarise(view, { baselineName: name(baseline.slot), candidateName: name(candidate.slot) })
  }, [view, baseline.slot, candidate.slot])

  const sameRun =
    baseline.slot.status === "ready" &&
    candidate.slot.status === "ready" &&
    baseline.slot.file === candidate.slot.file &&
    baseline.slot.runId === candidate.slot.runId

  const reuseBaseline =
    baseline.slot.status === "ready" && baseline.slot.file.runs.length > 1 ? baseline.slot : null

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">evalboard</h1>
        <p className="mt-2 text-ink-2">
          Drop in two eval runs and see exactly what got worse: regressions first, then fixes, then
          every score that moved. Files are read in your browser and never uploaded.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <RunLoader
          side="baseline"
          title="Baseline"
          hint="before the change"
          slot={baseline.slot}
          onFile={(file) => loadInto(baseline, file)}
        >
          {baseline.slot.status === "ready" ? (
            <RunPicker
              id="baseline-run"
              file={baseline.slot.file}
              runId={baseline.slot.runId}
              onChange={(runId) => pickRun(baseline, runId)}
            />
          ) : null}
        </RunLoader>

        <RunLoader
          side="candidate"
          title="Candidate"
          hint="after the change"
          slot={candidate.slot}
          onFile={(file) => loadInto(candidate, file)}
          actions={
            reuseBaseline ? (
              <button
                type="button"
                className={buttonClass}
                onClick={() =>
                  candidate.set({
                    status: "ready",
                    source: reuseBaseline.source,
                    file: reuseBaseline.file,
                    runId: defaultRunId(reuseBaseline.file, "candidate"),
                  })
                }
              >
                Pick another run from the baseline’s file
              </button>
            ) : null
          }
        >
          {candidate.slot.status === "ready" ? (
            <RunPicker
              id="candidate-run"
              file={candidate.slot.file}
              runId={candidate.slot.runId}
              onChange={(runId) => pickRun(candidate, runId)}
            />
          ) : null}
        </RunLoader>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-2">Try it with sample runs:</span>
        {SAMPLES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={sampleId === item.id}
            onClick={() => loadSample(item)}
            className={`${buttonClass} ${sampleId === item.id ? "border-ink text-ink" : ""}`}
          >
            {item.title}
          </button>
        ))}
      </div>
      {sample ? (
        <p className="mt-2 max-w-3xl text-sm text-ink-2" data-testid="sample-about">
          {sample.about}{" "}
          <a
            href={`${BASE_PATH}/${sample.path}`}
            download
            className="underline decoration-hairline underline-offset-2 hover:text-ink"
          >
            Download the file
          </a>{" "}
          to see the format.
        </p>
      ) : null}

      {view && corpus?.status === "different" && blocked ? (
        <section role="alert" className="mt-8 max-w-3xl rounded-lg border border-[var(--border)] bg-surface p-4" data-testid="corpus-warning">
          <h2 className="text-sm font-semibold text-ink">These runs were made over different documents</h2>
          <p className="mt-2 text-sm text-ink-2">
            The baseline’s corpus fingerprint is <code className="font-mono text-ink">{corpus.baseline}</code> and the
            candidate’s is <code className="font-mono text-ink">{corpus.candidate}</code>. A score can change because the
            documents changed, not because of what you changed, so evalboard does not compare them unless you ask.
          </p>
          <button type="button" className={`${buttonClass} mt-3`} onClick={() => setAcceptedPair(pair)}>
            Compare anyway
          </button>
        </section>
      ) : view ? (
        <div className="mt-8 space-y-6">
          {corpus?.status === "different" ? (
            <p className="text-sm text-ink-2" data-testid="corpus-note">
              Compared anyway: these runs were made over different documents ({corpus.baseline} and {corpus.candidate}).
            </p>
          ) : null}
          {sameRun ? (
            <p className="text-sm text-ink-2">Both sides are the same run, so nothing can differ. Pick another run to compare.</p>
          ) : null}

          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            <div className="w-full min-w-0 sm:w-auto sm:flex-1">
              <TagFilter all={all!.comparison} tag={activeTag} onChange={setTag} />
            </div>
            <ThresholdControl value={threshold} onChange={setThreshold} />
          </div>

          <Headline comparison={view} />

          <DeltaChart comparison={view} />

          <SummaryExport markdown={markdown} />

          <div className="rounded-lg border border-[var(--border)] bg-surface px-4 pb-3">
            <DeltaTable comparison={view} />
          </div>
        </div>
      ) : (
        <p className="mt-8 text-sm text-ink-2" data-testid="waiting">
          {waitingFor(baseline.slot, candidate.slot)}
        </p>
      )}

      <footer className="mt-12 border-t border-hairline pt-6 text-xs text-ink-3">
        <p>
          evalboard reads the results format that{" "}
          <a href="https://github.com/mohsinaliwork686-rgb/ragsweep" className="underline underline-offset-2 hover:text-ink-2">
            ragsweep
          </a>{" "}
          writes; any tool can write it too. Nothing you load leaves this page.{" "}
          <a href="https://github.com/mohsinaliwork686-rgb/evalboard" className="underline underline-offset-2 hover:text-ink-2">
            Source and format on GitHub
          </a>
          .
        </p>
      </footer>
    </main>
  )
}

function readyRun(slot: Slot) {
  if (slot.status !== "ready") return null
  return slot.file.runs.find((run) => run.id === slot.runId) ?? null
}

function waitingFor(baseline: Slot, candidate: Slot): string {
  const needed = [
    baseline.status === "ready" ? null : "a baseline",
    candidate.status === "ready" ? null : "a candidate",
  ].filter(Boolean)
  return needed.length === 2
    ? "Load a baseline and a candidate to compare them, or try a sample."
    : `Load ${needed[0]} to compare against.`
}

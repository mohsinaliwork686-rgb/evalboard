import ragsweepChunkSize from "../../public/samples/ragsweep-chunk-size.json"
import supportPrompt from "../../public/samples/support-prompt.json"
import { formatProblem, validateResults, type ResultsFile } from "./schema"

/**
 * The built-in examples behind "Try it with sample runs".
 *
 * They live in public/samples so the page can also offer them as downloads, the quickest way
 * to see the format, and they go through the same validator as any dropped file.
 */

export interface Sample {
  id: string
  title: string
  /** Where the numbers came from, shown next to the sample. Says plainly when they are made up. */
  about: string
  /** Under the site's base path, for the download link. */
  path: string
  file: ResultsFile
  baselineRun: string
  candidateRun: string
}

export const SAMPLES: Sample[] = [
  sample({
    id: "ragsweep-chunk-size",
    title: "Retrieval: doubling the chunk size",
    about:
      "Real runs from ragsweep's example: BM25 over a 17-document handbook, chunks of 512 against 1024 " +
      "characters. The mean score rises from 0.83 to 0.89, and two questions, both worded differently " +
      "from the handbook, fall out of the top two results.",
    path: "samples/ragsweep-chunk-size.json",
    raw: ragsweepChunkSize,
    baselineRun: "bm25-fixed-512-64",
    candidateRun: "bm25-fixed-1024-64",
  }),
  sample({
    id: "support-prompt",
    title: "Prompt: a support assistant, rewritten",
    about:
      "Made-up numbers, to show the shape of the problem: the mean rises from 0.71 to 0.74 while every " +
      "refund question collapses from 0.9 to 0.1.",
    path: "samples/support-prompt.json",
    raw: supportPrompt,
    baselineRun: "support-prompt-v1",
    candidateRun: "support-prompt-v2",
  }),
]

function sample(spec: Omit<Sample, "file"> & { raw: unknown }): Sample {
  const { raw, ...rest } = spec
  // A broken built-in sample is a bug in this repository, not a user's mistake: fail loudly.
  const result = validateResults(raw)
  if (!result.ok) {
    throw new Error(`sample ${spec.id} is invalid:\n${result.problems.map(formatProblem).join("\n")}`)
  }
  for (const runId of [spec.baselineRun, spec.candidateRun]) {
    if (!result.file.runs.some((run) => run.id === runId)) {
      throw new Error(`sample ${spec.id} has no run "${runId}"`)
    }
  }
  return { ...rest, file: result.file }
}

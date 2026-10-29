import type { ResultsFile } from "./schema"

/**
 * Were the two runs made over the same documents?
 *
 * A retrieval score depends on the documents searched as much as on the settings. Compare a run
 * over last month's handbook with one over this month's and every difference may come from the
 * documents, not the change being tested. When both files carry a corpus fingerprint and they
 * differ, the page refuses to compare until told to.
 */

export type CorpusCheck =
  | { status: "same" }
  /** At least one file has no fingerprint, so there is nothing to compare. Not an error. */
  | { status: "unknown" }
  | { status: "different"; baseline: string; candidate: string }

export function checkCorpus(baseline: ResultsFile, candidate: ResultsFile): CorpusCheck {
  if (baseline.fingerprint === undefined || candidate.fingerprint === undefined) return { status: "unknown" }
  if (baseline.fingerprint === candidate.fingerprint) return { status: "same" }
  return { status: "different", baseline: baseline.fingerprint, candidate: candidate.fingerprint }
}

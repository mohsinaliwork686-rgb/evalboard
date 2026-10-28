import { parseResults, type Problem, type ResultsFile } from "./schema"

/**
 * Reading a file the user picked or dropped. It is read in the browser with `File.text()`:
 * nothing is sent anywhere, and there is no server to send it to.
 */

/** Ten times ragsweep's full 54-run example. Past this, a tab may freeze reading it. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024

export type LoadResult =
  | { ok: true; source: string; file: ResultsFile }
  | { ok: false; source: string; problems: Problem[] }

/** Anything with a name, a size and text: a browser `File`, or a stand-in in the tests. */
export interface Readable {
  name: string
  size: number
  text(): Promise<string>
}

export async function loadFile(file: Readable): Promise<LoadResult> {
  const source = file.name
  if (file.size > MAX_FILE_BYTES) {
    // Rounded up, so a file just over the limit never reads as exactly on it.
    const megabytes = (Math.ceil((file.size / 1024 / 1024) * 10) / 10).toFixed(1)
    return {
      ok: false,
      source,
      problems: [{ path: "", message: `the file is ${megabytes} MB, over evalboard's 50 MB limit` }],
    }
  }
  let text: string
  try {
    text = await file.text()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { ok: false, source, problems: [{ path: "", message: `the file could not be read: ${reason}` }] }
  }
  const result = parseResults(text)
  return result.ok ? { ok: true, source, file: result.file } : { ok: false, source, problems: result.problems }
}

/**
 * Which run a side starts on: the first for the baseline, the last for the candidate. With a
 * one-run file that is the same run; with a ragsweep file of many it is two different ones, so
 * loading one file into both sides shows a comparison at once. The user can change either.
 */
export function defaultRunId(file: ResultsFile, side: "baseline" | "candidate"): string {
  return side === "baseline" ? file.runs[0].id : file.runs[file.runs.length - 1].id
}

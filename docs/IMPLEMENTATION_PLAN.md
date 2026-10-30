# Implementation plan — evalboard

> Written Monday 26 October 2026, before any code. Week 6 of the 10-week programme.

## 1. Problem

An eval is a fixed set of test cases an AI system is run against, each scored, often between 0
and 1. It is how you know whether a change helped. The usual way to read one is its average, and
the average lies: a prompt change can lift the mean from 0.71 to 0.74 while five cases collapse
from 0.9 to 0.1. If those five are all the same customer scenario, the average has hidden exactly
the thing that matters.

What is needed is the per-case comparison between two runs: which cases newly fail, which newly
pass, and how far each one moved. `evalboard` is a page that shows that.

## 2. Non-goals

- **It does not run evals.** It reads results something else produced.
- **It stores nothing and uploads nothing.** Files are read in the browser and never leave it.
- **No accounts, no backend, no history.** Load two runs, compare, export a summary, close the tab.
- **No statistics beyond the per-case view** in version one (no significance tests). The per-case
  view is what the average hides, and it is the point.

## 3. What the user does

1. Open the page. Load a results file for the baseline and one for the candidate, by picking or
   dropping them. They may be the same file: a `ragsweep` file holds many runs, so comparing two
   retrieval settings means picking two runs from one file.
2. If a file holds several runs, pick one from a list.
3. Read the comparison: regressions first, then fixes, then every case sorted by how far it
   moved. Narrow it to one tag.
4. Copy a Markdown summary into a pull request.

A "Try it with sample runs" button loads two built-in examples, so the page shows something useful
before anyone has a file of their own.

## 4. The file format, shared with `ragsweep`

Week 2's `ragsweep` already writes a versioned results file built for this. It holds per-case
detail, not just averages, precisely so this page can exist. `evalboard` reads that shape, and
documents it so any other tool can write it too:

```json
{
  "schema": 1,
  "tool": "ragsweep",
  "corpus": { "fingerprint": "d53c7ae1a1b0976c" },
  "runs": [
    {
      "id": "bm25-fixed-256-0",
      "cases": [
        { "id": "refund-window", "score": 1.0, "tags": ["refunds"] },
        { "id": "manager-signoff", "score": 0.0, "tags": ["approvals"], "passed": false }
      ]
    }
  ]
}
```

| Field | Rule |
|-------|------|
| `schema` | Required, must be `1`. A file with schema 2 is refused with "this file is schema 2; evalboard understands schema 1", not parsed and half-shown |
| `runs` | Required, at least one. Each run needs an `id`, unique in the file |
| `runs[].cases` | Required. Each case needs an `id`, unique in the run, and a `score`, a number from 0 to 1 |
| `tags` | Optional list of strings, for filtering |
| `passed` | Optional. When present it decides pass or fail; otherwise the score is compared with the threshold (section 5) |
| `corpus.fingerprint` | Optional. When both files have one and they differ, the runs were made over different documents |
| anything else | Ignored, so `ragsweep`'s extra fields (`retrieved`, `timing`...) do no harm |

**Validation names the place**, the Monday decision from the roadmap: not "failed to parse" but
`runs[0].cases[12]: missing field "score"`, or `runs[1].cases[3]: score 1.4 is outside 0 to 1`.
Every problem in a file is listed, not just the first.

## 5. Matching and classifying cases

- **Cases are matched by `id`, never by position**, the other Monday decision. Adding one case in
  the middle of a set must not shift every comparison after it.
- **Pass or fail** comes from `passed` when a case has it; otherwise `score >= threshold`. The
  threshold defaults to 0.5 and can be changed on the page. It is printed in the summary, because a
  pass rate without its threshold means nothing. For a `ragsweep` file the score is the reciprocal
  rank (1 at rank 1, 0.5 at rank 2, 0 when the passage was not found), so 0.5 means "the right
  passage came first or second".
- **Each case falls into exactly one class**:

  | Class | Meaning |
  |-------|---------|
  | regressed | passed in the baseline, fails in the candidate |
  | fixed | failed in the baseline, passes in the candidate |
  | worse / better | same pass or fail, but the score moved down or up |
  | unchanged | same score |
  | removed / added | in only one of the two runs |

- **Different corpora are refused by default.** If both files carry a corpus fingerprint and they
  differ, the page explains that the runs used different documents and does not compare them, with
  an explicit "compare anyway" for when that is intended.

## 6. What the page shows

- **The headline numbers, honestly framed**: mean score and pass rate for each run, and their
  change, next to the count of regressions. The average is shown, but never alone.
- **Regressions first**, then fixes, then every remaining case sorted by how far it moved.
- **A chart of per-case movement** (Recharts): each case's change, sorted, so a cluster of
  collapses stands out against a field of small gains.
- **A tag filter** that narrows everything, the numbers included.
- **Export summary**: Markdown with the runs, the threshold, the counts and the regressions, ready
  to paste into a pull request.

Colour is never the only signal: every class also has a word and a symbol.

## 7. Architecture

A fully static Next.js app, built the same way as week 3's `contextlab`.

| Piece | Job |
|-------|-----|
| `src/lib/schema.ts` | The format, and a validator that returns every problem with its path |
| `src/lib/diff.ts` | **Pure.** Two runs and a threshold in; classified cases and aggregates out |
| `src/lib/summary.ts` | **Pure.** A diff in, Markdown out |
| `src/lib/samples.ts` | The built-in sample runs |
| `src/components/` | RunLoader, RunPicker, Headline, DeltaTable, DeltaChart, TagFilter, SummaryExport |
| `src/app/page.tsx` | Wiring only |

Everything in `src/lib` is plain TypeScript with no React, tested without a browser.

**Decided on Monday, against the roadmap:**

- **GitHub Pages, not Vercel.** The roadmap said Vercel; `contextlab` already deploys static exports
  to GitHub Pages, which needs no second account. Same approach here, under `/evalboard`.
- **TypeScript 5, not 7.** TypeScript 7 (the new native compiler) is out, but Next.js's own type
  check is built on the TypeScript 5 interface. This week is not the time to find out where they
  disagree.

## 8. Build order

| Day | Work |
|-----|------|
| **Mon** | This plan and the README pitch, committed first. Then the project skeleton |
| **Tue** | `schema.ts` with the validator, `diff.ts`, `summary.ts`, the sample runs, all with tests |
| **Wed** | The page: loading files, picking runs, the headline, the table, the tag filter |
| **Thu** | The chart, the export, the fingerprint check, browser tests, CI and the Pages deploy |
| **Fri** | README with real screenshots, publish, link `ragsweep` and `evalboard` to each other, portfolio and roadmap |

## 9. Test plan

| Area | Must work | Must not break |
|------|-----------|----------------|
| schema | a real `ragsweep` file validates; a minimal hand-written file validates | each kind of bad file gives its own message with a path: wrong schema, missing field, bad score, duplicate id, wrong types, not JSON; every problem listed |
| diff | identical runs give nothing but "unchanged"; a case that flips each way | cases in only one run; completely different case sets; `passed` overriding the threshold; the threshold edge (exactly 0.5) |
| aggregates | means, pass rates and counts against hand-worked numbers | an empty tag filter; a run with no cases left after filtering |
| summary | a snapshot of the Markdown for the sample runs | regressions listed by name; the threshold printed |
| page (browser) | load two files, see regressions first, filter by tag, copy the summary | a bad file shows its errors and nothing else; **no network request carries file contents** |

## 10. Risks

| Risk | Mitigation |
|------|------------|
| The shared format drifts between the two repos | The schema is versioned; `evalboard`'s tests validate the real `ragsweep` example file |
| A big file (the full `ragsweep` example is 1 MB, 54 runs) makes the page slow | Only the two chosen runs are diffed; tested with the real file |
| The average is still read as the answer | It is never shown without the regression count next to it |
| Comparing runs over different documents | Fingerprint check, refused by default |

## 11. Definition of done

Shipped Friday 30 October 2026.

- [x] Public repo, description and topics
- [x] This plan, committed before the code
- [x] Live on GitHub Pages, working on the built-in samples
- [x] README with real screenshots, the format, and a link to `ragsweep` (and `ragsweep` linking back)
- [x] Every row of the test plan covered
- [x] CI green: unit tests, type check, lint, browser tests, deploy
- [x] At least 10 commits, one logical change each

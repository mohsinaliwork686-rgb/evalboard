# evalboard

**Drop in two eval runs. See exactly what got worse.**

> Week 6 of a 10-week build. In progress: see [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
> for the design.

---

## The problem

You change a prompt and the eval's average goes from 0.71 to 0.74. Ship it? Underneath, forty cases
improved a little and five collapsed from 0.9 to 0.1, and they were all the same customer scenario.
The average hid it completely.

## What it does

A web page. Load two results files and it shows, per case:

- **regressions first**: cases that passed before and fail now
- **fixes**: cases that failed before and pass now
- **every score change**, sorted by how far it moved, with a chart that makes a cluster of
  collapses stand out
- **a tag filter**, to look at one category at a time
- **a Markdown summary** to paste into a pull request

Files are read in the browser and never uploaded. There is no backend.

It reads the results file that [ragsweep](https://github.com/mohsinaliwork686-rgb/ragsweep) writes,
so the two work as a pair: sweep retrieval settings with one, compare any two runs with the other.
Any tool can write the same small format.

## Status

| Day | Work | |
|-----|------|-|
| Mon | Plan and README | done |
| Tue | The format and its validator, the diff, the summary | done |
| Wed | The page: loading, the table, the tag filter | done |
| Thu | The chart, the export, browser tests, CI, deploy | |
| Fri | Screenshots, publish | |

## Non-goals

- **It does not run evals.** It reads their results.
- **It stores nothing.** No accounts, no history, no uploads.

## License

MIT. See [LICENSE](LICENSE).

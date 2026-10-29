import path from "node:path"

import { expect, test, type Page, type Request } from "@playwright/test"

/*
 * The page in a real browser against the real static build. The logic is covered by the unit
 * tests; these prove the page wires it up: it loads files, puts regressions first, filters,
 * copies the summary, refuses what it should, and sends nothing anywhere.
 */

// Playwright loads specs as CommonJS, so __dirname, not import.meta.url.
const fixture = (name: string) => path.join(__dirname, "fixtures", name)
const RAGSWEEP = path.join(__dirname, "..", "tests", "fixtures", "ragsweep-results.json")

const verdict = (page: Page) => page.getByTestId("verdict")
const table = (page: Page) => page.getByTestId("delta-table")

test("puts the regressions first for the sample", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Prompt: a support assistant, rewritten" }).click()
  await expect(verdict(page)).toHaveText("5 cases regressed while the mean score rose from 0.710 to 0.740.")
  await expect(page.getByTestId("sample-about")).toContainText("Made-up numbers")

  const rows = table(page).locator("tbody tr[data-change]")
  await expect(rows.first()).toHaveAttribute("data-change", "regressed")
  for (let index = 0; index < 5; index += 1) {
    await expect(rows.nth(index)).toHaveAttribute("data-change", "regressed")
  }
  await expect(rows.nth(5)).toHaveAttribute("data-change", "fixed")
  await expect(page.getByTestId("delta-chart")).toBeVisible()
})

test("narrows everything to one tag", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Prompt: a support assistant, rewritten" }).click()
  await page.getByRole("button", { name: /^refunds, 5 cases, 5 regressed/ }).click()
  await expect(verdict(page)).toHaveText("5 cases regressed, and the mean score fell from 0.900 to 0.100.")
  await expect(table(page).locator("tbody tr[data-change]")).toHaveCount(5)

  await page.getByRole("button", { name: /^All cases/ }).click()
  await expect(verdict(page)).toContainText("rose from 0.710 to 0.740")
})

test("moves the pass mark with the threshold", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Retrieval: doubling the chunk size" }).click()
  await expect(verdict(page)).toHaveText("2 cases regressed while the mean score rose from 0.828 to 0.892.")
  // At 0.3, q13 (0.5 to 0.333, third place) still passes and drops out of the regressions;
  // q11 (0.5 to 0.2, fifth place) still fails and stays.
  await page.getByLabel("Pass at").fill("0.3")
  await expect(verdict(page)).toHaveText("1 case regressed while the mean score rose from 0.828 to 0.892.")
})

test("copies the summary as Markdown", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/")
  await page.getByRole("button", { name: "Prompt: a support assistant, rewritten" }).click()
  await page.getByRole("button", { name: "Copy as Markdown" }).click()
  await expect(page.getByText("Copied.")).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain("### evalboard: `support-prompt-v1` → `support-prompt-v2`")
  expect(copied).toContain("**5 cases regressed** while the mean score rose from 0.710 to 0.740.")
  expect(copied).toContain("| `refund-after-30-days` | refunds | 0.900 | 0.100 | -0.800 |")
})

test("shows a bad file's problems and nothing else", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("baseline-input").setInputFiles(fixture("bad.json"))
  const alert = page.getByTestId("baseline-loader").getByRole("alert")
  await expect(alert).toContainText("bad.json can’t be compared: 4 problems")
  await expect(alert).toContainText("runs[0].cases[0].score: 1.4 is outside 0 to 1")
  await expect(alert).toContainText('runs[0].cases[1]: missing field "score"')
  await expect(alert).toContainText('runs[0].cases[2].id: "a" is already used by runs[0].cases[0]')

  // Even with a good candidate, a broken baseline means no comparison at all.
  await page.getByTestId("candidate-input").setInputFiles(RAGSWEEP)
  await expect(page.getByTestId("candidate-loader")).toContainText("Run, of 54 in this file")
  await expect(verdict(page)).toHaveCount(0)
  await expect(table(page)).toHaveCount(0)
  await expect(page.getByTestId("delta-chart")).toHaveCount(0)
})

test("compares two runs from one real ragsweep file", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("baseline-input").setInputFiles(RAGSWEEP)
  await page.getByRole("button", { name: "Pick another run from the baseline’s file" }).click()
  await page.getByLabel("Run, of 54 in this file").first().selectOption("bm25-fixed-512-64")
  await page.getByLabel("Run, of 54 in this file").last().selectOption("bm25-fixed-1024-64")
  await expect(verdict(page)).toHaveText("2 cases regressed while the mean score rose from 0.828 to 0.892.")
})

test("refuses runs over different documents until asked", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("baseline-input").setInputFiles(RAGSWEEP)
  await page.getByTestId("candidate-input").setInputFiles(fixture("other-documents.json"))
  const warning = page.getByTestId("corpus-warning")
  await expect(warning).toContainText("These runs were made over different documents")
  await expect(warning).toContainText("d53c7ae1a1b0976c")
  await expect(warning).toContainText("0f1e2d3c4b5a6978")
  await expect(table(page)).toHaveCount(0)

  await page.getByRole("button", { name: "Compare anyway" }).click()
  await expect(table(page)).toBeVisible()
  await expect(page.getByTestId("corpus-note")).toContainText("Compared anyway")
})

test("never sends a loaded file anywhere", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/")
  await page.waitForLoadState("networkidle")

  // Everything requested from here on: loading, comparing, filtering, copying.
  const requests: Request[] = []
  page.on("request", (request) => requests.push(request))

  await page.getByTestId("baseline-input").setInputFiles(fixture("canary.json"))
  await page.getByRole("button", { name: "Pick another run from the baseline’s file" }).click()
  await expect(verdict(page)).toHaveText("1 case regressed, and the mean score fell from 0.600 to 0.450.")
  await page.getByRole("button", { name: /^canary-tag-3b7a/ }).click()
  await page.getByRole("button", { name: "Copy as Markdown" }).click()
  await expect(page.getByText("Copied.")).toBeVisible()
  await page.waitForLoadState("networkidle")

  const origin = new URL(page.url()).origin
  for (const request of requests) {
    // Lazily loaded code is fine; anything carrying data, or going elsewhere, is not.
    expect(request.method(), request.url()).toBe("GET")
    expect(request.postData(), request.url()).toBeNull()
    expect(new URL(request.url()).origin, request.url()).toBe(origin)
    expect(request.url()).not.toContain("canary")
  }
})

test("fits the screen without scrolling sideways", async ({ page }) => {
  await page.goto("/")
  // The retrieval sample: long run ids in the pickers, and unchanged cases to unfold.
  await page.getByRole("button", { name: "Retrieval: doubling the chunk size" }).click()
  await page.getByRole("button", { name: "Show", exact: true }).click()
  await expect(table(page).locator("tbody tr[data-change='unchanged']")).toHaveCount(24)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

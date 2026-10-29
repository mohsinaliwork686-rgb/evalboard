"use client"

import { Bar, BarChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts"

import { axisLimit, axisTicks, chartPoints, type ChartPoint } from "@/lib/chart"
import type { ChangeClass, Comparison } from "@/lib/diff"
import { formatScore, formatScoreChange, scoreDirection } from "@/lib/format"

import { ChangeIcon, GROUPS, type Group } from "./ChangeIcon"
import { Delta } from "./Delta"

/**
 * Each case's change in score, sorted, so a cluster of collapses stands out against a field of
 * small gains.
 *
 * Colour follows the same classes as the table and the tiles: regressed and fixed are the only
 * coloured bars, everything else is neutral. Direction is already carried by position (above or
 * below zero), so colour is free to say which cases crossed the pass mark. The legend names each
 * colour, and the table below is the same data for anyone who cannot use the chart.
 */

const FILL: Partial<Record<ChangeClass, string>> = {
  regressed: "var(--status-critical)",
  fixed: "var(--status-good)",
}
const NEUTRAL = "var(--text-muted)"

export function DeltaChart({ comparison }: { comparison: Comparison }) {
  const points = chartPoints(comparison)
  if (points.length === 0) return null
  const limit = axisLimit(points)

  return (
    <figure className="rounded-lg border border-[var(--border)] bg-surface p-4" data-testid="delta-chart">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <figcaption className="text-sm font-semibold text-ink">
          Change in score, case by case{" "}
          <span className="font-normal text-ink-3">from the biggest drop to the biggest gain</span>
        </figcaption>
        <Legend />
      </div>
      <div
        role="img"
        aria-label={`Change in score for ${points.length} cases, sorted from the biggest drop to the biggest gain: ${comparison.counts.regressed} regressed, ${comparison.counts.fixed} fixed. The table below lists every case.`}
        className="mt-3"
      >
        <BarChart
          data={points}
          responsive
          style={{ width: "100%", height: 220 }}
          margin={{ top: 8, right: 4, bottom: 8, left: 0 }}
          barCategoryGap={2}
          maxBarSize={24}
          // The chart is an image to assistive technology, labelled above, and the table is its
          // accessible form; Recharts' keyboard layer would put a focusable element inside an image.
          accessibilityLayer={false}
        >
          <CartesianGrid vertical={false} stroke="var(--hairline)" />
          <XAxis dataKey="id" hide />
          <YAxis
            domain={[-limit, limit]}
            ticks={axisTicks(limit)}
            // Every tick, always: by default Recharts drops end labels it thinks will crowd,
            // and an axis with its bottom label missing reads as if it stops short.
            interval={0}
            tickFormatter={signedTick}
            axisLine={false}
            tickLine={false}
            width={44}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          />
          <ReferenceLine y={0} stroke="var(--baseline)" />
          <Tooltip content={TooltipBody} cursor={{ fill: "var(--track)" }} isAnimationActive={false} />
          <Bar dataKey="delta" shape={BarShape} isAnimationActive={false} />
        </BarChart>
      </div>
    </figure>
  )
}

function Legend() {
  const items: Array<{ group: Group; label: string }> = [
    { group: "regressed", label: "Regressed" },
    { group: "fixed", label: "Fixed" },
    { group: "moved", label: "Everything else" },
  ]
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Legend">
      {items.map((item) => (
        <li key={item.group} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: item.group === "moved" ? NEUTRAL : FILL[item.group] }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * A bar with its far end rounded and its base square on the zero line. A bar for an unchanged
 * case would have no height at all, so it gets a sliver: the case is there, it just did not move.
 */
function BarShape(props: { x?: number; y?: number; width?: number; height?: number; payload?: ChartPoint }) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props
  if (!payload || width <= 0) return null
  const fill = FILL[payload.change] ?? NEUTRAL
  const top = Math.min(y, y + height)
  const size = Math.abs(height)
  if (size < 1.5) {
    return <rect x={x} y={top - 0.75} width={width} height={1.5} fill={fill} />
  }
  const r = Math.min(4, width / 2, size / 2)
  const right = x + width
  const bottom = top + size
  const d =
    payload.delta >= 0
      ? `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${right - r}Q${right},${top} ${right},${top + r}V${bottom}Z`
      : `M${x},${top}V${bottom - r}Q${x},${bottom} ${x + r},${bottom}H${right - r}Q${right},${bottom} ${right},${bottom - r}V${top}Z`
  return <path d={d} fill={fill} />
}

function TooltipBody({ active, payload }: TooltipContentProps) {
  const point = active ? (payload?.[0]?.payload as ChartPoint | undefined) : undefined
  if (!point) return null
  const group = GROUPS.find((spec) => spec.classes.includes(point.change))!
  return (
    <div className="rounded-md border border-[var(--border)] bg-surface px-3 py-2 text-xs shadow-sm">
      <div className="font-mono text-[12px] text-ink">{point.id}</div>
      <div className="mt-1 flex items-center gap-1.5 text-ink-2">
        <ChangeIcon group={group.id} className="h-3.5 w-3.5" />
        {group.label}
      </div>
      <div className="tabular mt-1 text-ink">
        {formatScore(point.before)} → {formatScore(point.after)}{" "}
        <Delta way={scoreDirection(point.before, point.after)}>{formatScoreChange(point.before, point.after)}</Delta>
      </div>
    </div>
  )
}

function signedTick(value: number): string {
  if (value === 0) return "0"
  return `${value > 0 ? "+" : "−"}${Math.abs(value)}`
}

"use client"

import { useState } from "react"

/**
 * The pass mark for cases without their own `passed`. The field keeps whatever is typed, so
 * "0." on the way to "0.75" is not snapped back; only a number from 0 to 1 is applied.
 */
export function ThresholdControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value))
  const parsed = Number(text)
  const valid = text.trim() !== "" && parsed >= 0 && parsed <= 1

  return (
    <div className="max-w-[16rem]">
      <label htmlFor="threshold" className="block text-xs text-ink-3">
        Pass at
      </label>
      <input
        id="threshold"
        type="number"
        inputMode="decimal"
        min={0}
        max={1}
        step={0.05}
        value={text}
        aria-invalid={!valid}
        aria-describedby="threshold-hint"
        onChange={(event) => {
          setText(event.target.value)
          const next = Number(event.target.value)
          if (event.target.value.trim() !== "" && next >= 0 && next <= 1) onChange(next)
        }}
        className="tabular mt-1 block w-24 rounded-md border border-[var(--border)] bg-surface px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <p id="threshold-hint" className="mt-1 text-xs text-ink-2">
        {valid ? "or above, unless the file marks a case pass or fail" : `from 0 to 1; still using ${value}`}
      </p>
    </div>
  )
}

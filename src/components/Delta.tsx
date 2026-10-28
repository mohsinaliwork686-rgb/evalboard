import type { Direction } from "@/lib/format"

/** A signed change, coloured by direction. Up is good for every number on this page. */
export function Delta({ way, children }: { way: Direction; children: React.ReactNode }) {
  const color = way === "up" ? "var(--delta-up-text)" : way === "down" ? "var(--delta-down-text)" : undefined
  return <span style={{ color }}>{children}</span>
}

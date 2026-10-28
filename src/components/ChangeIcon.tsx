import type { ChangeClass } from "@/lib/diff"

/**
 * The groups the table and the tiles show, and the icon for each.
 *
 * Worse and better share one group, "moved": the same result either way, sorted by how far
 * the score went. Splitting them would separate a 0.6 drop from a 0.6 rise that sit next to
 * each other in importance.
 *
 * Only regressed and fixed get a colour. Everything else is neutral, so the two colours on the
 * page are the two things worth looking at.
 */

export type Group = "regressed" | "fixed" | "moved" | "unchanged" | "removed" | "added"

export interface GroupSpec {
  id: Group
  label: string
  description: string
  classes: ChangeClass[]
}

export const GROUPS: GroupSpec[] = [
  { id: "regressed", label: "Regressed", description: "passed before, fails now", classes: ["regressed"] },
  { id: "fixed", label: "Fixed", description: "failed before, passes now", classes: ["fixed"] },
  { id: "moved", label: "Moved", description: "same result, the score changed", classes: ["worse", "better"] },
  { id: "unchanged", label: "Unchanged", description: "same score", classes: ["unchanged"] },
  { id: "removed", label: "Removed", description: "only in the baseline", classes: ["removed"] },
  { id: "added", label: "Added", description: "only in the candidate", classes: ["added"] },
]

const GLYPHS: Record<Group, string> = {
  regressed: "M8 4.5v6M5.5 8.5L8 11l2.5-2.5",
  fixed: "M4.5 8.3l2.3 2.3L11.5 6",
  moved: "M6 4.8v6.4M4.2 6.6L6 4.8l1.8 1.8M10 11.2V4.8M8.2 9.4l1.8 1.8 1.8-1.8",
  unchanged: "M5 6.8h6M5 9.2h6",
  removed: "M5 8h6",
  added: "M5 8h6M8 5v6",
}

const FILLS: Partial<Record<Group, string>> = {
  regressed: "var(--status-critical)",
  fixed: "var(--status-good)",
}

export function ChangeIcon({ group, className = "h-4 w-4" }: { group: Group; className?: string }) {
  const fill = FILLS[group]
  return (
    <svg viewBox="0 0 16 16" className={`${className} shrink-0`} aria-hidden="true">
      {fill ? (
        <circle cx="8" cy="8" r="7.5" fill={fill} />
      ) : (
        <circle cx="8" cy="8" r="7" fill="none" stroke="var(--baseline)" strokeWidth="1" />
      )}
      <path
        d={GLYPHS[group]}
        stroke={fill ? "white" : "var(--text-secondary)"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

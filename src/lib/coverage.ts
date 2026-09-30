// Works out who covers which part of each shift, and where there are gaps.
// Pure module — used by the admin overview and tested in isolation.

export type Window = { start: Date; end: Date | null }; // end null = "until done"
export type HelperWindows = { userId: string; windows: Window[] };
export type ShiftLike = {
  id: string;
  startsAt: Date;
  endsAt: Date | null;
  helpersNeeded: number;
};

export type Range = { start: Date; end: Date };
export type ShiftCoverage = {
  shiftId: string;
  range: Range; // the span we measured (open-ended shifts: +2h)
  helpers: { userId: string; full: boolean; ranges: Range[] }[];
  gaps: (Range & { have: number })[]; // parts where fewer than helpersNeeded are present
};

const OPEN_END_FALLBACK_MS = 2 * 3600_000;

export function shiftRange(s: ShiftLike): Range {
  const end = s.endsAt ?? new Date(s.startsAt.getTime() + OPEN_END_FALLBACK_MS);
  return { start: s.startsAt, end };
}

/** Clip windows to a range and merge overlaps. */
export function clipAndMerge(windows: Window[], range: Range): Range[] {
  const clipped = windows
    .map((w) => ({
      start: new Date(Math.max(w.start.getTime(), range.start.getTime())),
      end: new Date(Math.min((w.end ?? range.end).getTime(), range.end.getTime())),
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: Range[] = [];
  for (const r of clipped) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      if (r.end > last.end) last.end = r.end;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

export function shiftCoverage(shift: ShiftLike, helpers: HelperWindows[]): ShiftCoverage {
  const range = shiftRange(shift);
  const covered = helpers
    .map((h) => {
      const ranges = clipAndMerge(h.windows, range);
      const full = ranges.length === 1 && +ranges[0].start === +range.start && +ranges[0].end === +range.end;
      return { userId: h.userId, full, ranges };
    })
    .filter((h) => h.ranges.length > 0);

  // Sweep over every boundary and count people present in each slice.
  const points = new Set<number>([+range.start, +range.end]);
  for (const h of covered) for (const r of h.ranges) points.add(+r.start).add(+r.end);
  const sorted = [...points].sort((a, b) => a - b);

  const gaps: ShiftCoverage["gaps"] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const have = covered.filter((h) => h.ranges.some((r) => +r.start <= a && +r.end >= b)).length;
    if (have >= shift.helpersNeeded) continue;
    const last = gaps[gaps.length - 1];
    if (last && +last.end === a && last.have === have) last.end = new Date(b);
    else gaps.push({ start: new Date(a), end: new Date(b), have });
  }

  return { shiftId: shift.id, range, helpers: covered, gaps };
}

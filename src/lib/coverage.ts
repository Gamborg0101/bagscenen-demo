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
/** A coordinator's "Det er fint": in this range, `enough` people are enough. */
export type Approval = Range & { enough: number };
export type ShiftCoverage = {
  shiftId: string;
  range: Range; // the span we measured (open-ended shifts: +2h)
  helpers: { userId: string; full: boolean; ranges: Range[] }[];
  gaps: (Range & { have: number })[]; // parts where fewer than helpersNeeded are present (and not approved)
  approvedGaps: (Range & { have: number })[]; // gaps a coordinator has said are fine
  peak: number; // most people present at the same time
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

export function shiftCoverage(shift: ShiftLike, helpers: HelperWindows[], approvals: Approval[] = []): ShiftCoverage {
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
  const approvedGaps: ShiftCoverage["approvedGaps"] = [];
  let peak = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const have = covered.filter((h) => h.ranges.some((r) => +r.start <= a && +r.end >= b)).length;
    peak = Math.max(peak, have);
    if (have >= shift.helpersNeeded) continue;
    const approved = approvals.some((x) => +x.start <= a && +x.end >= b && have >= x.enough);
    const list = approved ? approvedGaps : gaps;
    const last = list[list.length - 1];
    if (last && +last.end === a && last.have === have) last.end = new Date(b);
    else list.push({ start: new Date(a), end: new Date(b), have });
  }

  return { shiftId: shift.id, range, helpers: covered, gaps, approvedGaps, peak };
}

/** How many more people are present at the busiest moment than the shift needs. */
export function overbooking(c: ShiftCoverage, helpersNeeded: number): number {
  return Math.max(0, c.peak - helpersNeeded);
}

export type GapPart = Range & { shiftId: string };
/** One line in the coordinator's gap list; `parts` are the per-shift gaps it stands for. */
export type GapRow = Range & {
  have: number;
  needed: number;
  shiftIds: string[];
  parts: GapPart[];
  reapproved: number | null; // an approval said this many were enough, but fewer are left now
};

/**
 * Turns the per-shift gaps into list rows, merging back-to-back gaps across shifts
 * that read the same ("Mangler 1 · 2 af 3 på"), so 08–10 + 10–17 becomes one 08–17 row.
 */
export function gapRows(shifts: (ShiftLike & { approvals: Approval[] })[], coverage: Map<string, ShiftCoverage>): GapRow[] {
  const single = shifts
    .flatMap((s) =>
      coverage.get(s.id)!.gaps.map((g) => {
        const broken = s.approvals.filter((a) => a.start < g.end && a.end > g.start && a.enough > g.have);
        const reapproved = broken.length ? Math.max(...broken.map((a) => a.enough)) : null;
        return { start: g.start, end: g.end, have: g.have, needed: s.helpersNeeded, shiftId: s.id, reapproved };
      }),
    )
    .sort((a, b) => +a.start - +b.start || +a.end - +b.end);

  const rows: GapRow[] = [];
  for (const g of single) {
    const last = rows[rows.length - 1];
    const part = { shiftId: g.shiftId, start: g.start, end: g.end };
    if (last && +last.end === +g.start && last.have === g.have && last.needed === g.needed && last.reapproved === g.reapproved) {
      last.end = g.end;
      last.parts.push(part);
      if (!last.shiftIds.includes(g.shiftId)) last.shiftIds.push(g.shiftId);
    } else {
      rows.push({ start: g.start, end: g.end, have: g.have, needed: g.needed, reapproved: g.reapproved, shiftIds: [g.shiftId], parts: [part] });
    }
  }
  return rows;
}

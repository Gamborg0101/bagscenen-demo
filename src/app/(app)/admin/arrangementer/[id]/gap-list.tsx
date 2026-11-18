import { Fragment } from "react";
import type { GapApproval, Shift } from "@prisma/client";
import { gapRows, type ShiftCoverage } from "@/lib/coverage";
import { buttonClass } from "@/components/styles";
import { formatRange } from "@/lib/datetime";
import { shiftName } from "@/lib/events/format";
import { approveGap, unapproveGap } from "../actions";

type ShiftWithApprovals = Shift & { gapApprovals: GapApproval[] };

/**
 * Coordinator view of the gaps: "Det er fint" approves fewer people for that window
 * (e.g. two are enough during dinner); "Fortryd" takes the approval back.
 * Back-to-back gaps that read the same are one row, even across shifts.
 */
export function GapList({ shifts, coverage }: { shifts: ShiftWithApprovals[]; coverage: Map<string, ShiftCoverage> }) {
  const byId = new Map(shifts.map((s) => [s.id, s]));
  const names = (ids: string[]) => [...new Set(ids.map((id) => shiftName(byId.get(id)!)))].join(" + ");

  const rows = gapRows(
    shifts.map((s) => ({ ...s, approvals: s.gapApprovals.map((a) => ({ start: a.startsAt, end: a.endsAt, enough: a.enough })) })),
    coverage,
  );
  // Approvals that no longer hold show up on their gap row ("godkendt til 2"), not down here.
  const gaps = shifts.flatMap((s) => coverage.get(s.id)!.gaps.map((g) => ({ ...g, shiftId: s.id })));
  const broken = (a: GapApproval) => gaps.some((g) => g.shiftId === a.shiftId && a.startsAt < g.end && a.endsAt > g.start && a.enough > g.have);
  const approvals = mergeApprovals(shifts.flatMap((s) => s.gapApprovals).filter((a) => !broken(a)));
  if (rows.length + approvals.length === 0) return null;

  return (
    <ul className="space-y-1.5 text-xs">
      {rows.map((r) => (
        <li key={`${r.shiftIds.join("-")}-${+r.start}`} className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex-1 tabular-nums">
            <span className="text-danger">Mangler {r.needed - r.have}</span> · {names(r.shiftIds)} {formatRange(r.start, r.end)} · {r.have} af {r.needed} på
            {r.reapproved !== null && (
              <span className="text-muted">
                {" "}
                · var godkendt med {r.reapproved}
              </span>
            )}
          </span>
          <form action={approveGap}>
            {r.parts.map((p) => (
              <Fragment key={`${p.shiftId}-${+p.start}`}>
                <input type="hidden" name="shiftId" value={p.shiftId} />
                <input type="hidden" name="startsAt" value={p.start.toISOString()} />
                <input type="hidden" name="endsAt" value={p.end.toISOString()} />
              </Fragment>
            ))}
            <input type="hidden" name="enough" value={r.have} />
            <button className={buttonClass("secondary", "sm")}>Det er fint</button>
          </form>
        </li>
      ))}
      {approvals.map((a) => (
        <li key={a.ids[0]} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
          <span className="flex-1 tabular-nums">
            Det er fint · {names(a.shiftIds)} {formatRange(a.start, a.end)} · {a.enough} er nok
          </span>
          <form action={unapproveGap}>
            {a.ids.map((id) => (
              <input key={id} type="hidden" name="approvalId" value={id} />
            ))}
            <button className="underline underline-offset-2 hover:text-fg">Fortryd</button>
          </form>
        </li>
      ))}
    </ul>
  );
}

/** Back-to-back approvals with the same "enough" (one click on a merged row) read as one line. */
function mergeApprovals(list: GapApproval[]) {
  const rows: { ids: string[]; shiftIds: string[]; start: Date; end: Date; enough: number }[] = [];
  for (const a of [...list].sort((x, y) => +x.startsAt - +y.startsAt)) {
    const last = rows[rows.length - 1];
    if (last && +last.end === +a.startsAt && last.enough === a.enough) {
      last.end = a.endsAt;
      last.ids.push(a.id);
      if (!last.shiftIds.includes(a.shiftId)) last.shiftIds.push(a.shiftId);
    } else {
      rows.push({ ids: [a.id], shiftIds: [a.shiftId], start: a.startsAt, end: a.endsAt, enough: a.enough });
    }
  }
  return rows;
}

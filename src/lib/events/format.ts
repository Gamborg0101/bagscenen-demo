import type { Availability, Shift } from "@prisma/client";
import { formatRange, formatShortDay, formatTime, toDateInput } from "@/lib/datetime";
import { anchorIsDeadline, formatDuration } from "./form";
import { SHIFT_KIND_LABEL } from "./labels";

/** "Opsætning", "Opsætning · scene", or just the label for an "Andet" shift ("Klargøring"). */
export function shiftName(s: Pick<Shift, "kind" | "label">): string {
  if (!s.label) return SHIFT_KIND_LABEL[s.kind];
  return s.kind === "ANDET" ? s.label : `${SHIFT_KIND_LABEL[s.kind]} · ${s.label}`;
}

/** "15.00–18.00", "18.00–færdig", or for duration shifts "klar senest 15.00 · ca. 2 t" / "fra 18.00 · ca. 1 t". */
export function shiftTimeText(s: Pick<Shift, "kind" | "startsAt" | "endsAt" | "durationMinutes">): string {
  if (s.durationMinutes != null) {
    const anchor = anchorIsDeadline(s.kind) && s.endsAt ? `klar senest ${formatTime(s.endsAt)}` : `fra ${formatTime(s.startsAt)}`;
    return `${anchor} · ca. ${formatDuration(s.durationMinutes)}`;
  }
  return formatRange(s.startsAt, s.endsAt, "færdig");
}

/** "Opsætning 13.00–15.00, 16.00–færdig" — shifts by name, with the helper's actual times. */
export function describeAvailability(avails: Availability[], shifts: Shift[], eventDay: string): string[] {
  return avails.map((a) => {
    const shift = a.shiftId ? shifts.find((s) => s.id === a.shiftId) : undefined;
    const fixed = shift && shift.durationMinutes == null;
    const start = fixed ? shift.startsAt : a.startsAt;
    const end = fixed ? shift.endsAt : a.endsAt;
    const day = toDateInput(start) !== eventDay ? `${formatShortDay(start)} ` : "";
    const time = `${day}${formatRange(start, end, "færdig")}`;
    return shift ? `${shiftName(shift)} ${time}` : time;
  });
}

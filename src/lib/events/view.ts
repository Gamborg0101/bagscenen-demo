import "server-only";
import type { Availability, InvitationStatus, Shift } from "@prisma/client";
import type { NoteView } from "@/components/notes-log";
import { shiftCoverage, type ShiftCoverage } from "@/lib/coverage";
import { formatShortDay, formatStamp, toDateInput, toTimeInput } from "@/lib/datetime";
import { formatDuration } from "./form";
import { shiftName, shiftTimeText } from "./format";
import { hasRole, type CurrentUser } from "@/lib/session";
import { availabilityWindow, type EventInvitation, type EventNoteWithAuthor } from "./access";

export function displayName(u: { firstName: string; lastName: string; anonymizedAt: Date | null } | null): string {
  if (!u || u.anonymizedAt) return "Tidligere medhjælper";
  return `${u.firstName} ${u.lastName}`;
}

/** Coverage for every shift, counting only helpers who have said yes. */
type CoverageInvitation = { status: InvitationStatus; userId: string; availabilities: Availability[] };

export function eventCoverage(shifts: Shift[], invitations: CoverageInvitation[]): Map<string, ShiftCoverage> {
  const accepted = invitations.filter((i) => i.status === "ACCEPTED");
  const isDuration = (id: string | null) => !!id && shifts.some((s) => s.id === id && s.durationMinutes != null);

  return new Map(
    shifts.map((s) => {
      const helpers = accepted.map((i) => ({
        userId: i.userId,
        // Duration shift: taking it covers it, whenever the helper chose to start.
        // Fixed shift: measured against actual time windows (excluding duration-shift picks).
        windows:
          s.durationMinutes != null
            ? i.availabilities.some((a) => a.shiftId === s.id)
              ? [{ start: s.startsAt, end: s.endsAt }]
              : []
            : i.availabilities.filter((a) => !isDuration(a.shiftId)).map((a) => availabilityWindow(a, shifts)),
      }));
      return [s.id, shiftCoverage(s, helpers)];
    }),
  );
}

export function staffingFrom(coverage: Map<string, ShiftCoverage>) {
  return Object.fromEntries(
    [...coverage].map(([id, c]) => [id, { have: c.helpers.length, hasGaps: c.gaps.length > 0 }]),
  );
}

export function notesView(notes: EventNoteWithAuthor[], viewer: CurrentUser): NoteView[] {
  const isLead = hasRole(viewer.role, "LEAD");
  return notes.map((n) => ({
    id: n.id,
    author: displayName(n.author),
    when: formatStamp(n.createdAt),
    body: n.body,
    canDelete: isLead || n.authorId === viewer.id,
  }));
}

/** Rows for the coverage timeline: helpers who said yes, with short names. */
export function timelineHelpers(invitations: EventInvitation[], shifts: Shift[], viewerId?: string) {
  return invitations
    .filter((i) => i.status === "ACCEPTED")
    .map((i) => ({
      id: i.id,
      name: i.user.anonymizedAt ? "Tidl." : `${i.user.firstName} ${i.user.lastName.charAt(0)}.`,
      isYou: i.userId === viewerId,
      windows: i.availabilities.map((a) => availabilityWindow(a, shifts)),
    }));
}

/** One-word staffing status for list views. */
export function staffingSummary(shifts: Shift[], invitations: CoverageInvitation[]) {
  if (shifts.length === 0) return null;
  const coverage = [...eventCoverage(shifts, invitations).values()];
  const accepted = invitations.filter((i) => i.status === "ACCEPTED").length;
  const declined = invitations.filter((i) => i.status === "DECLINED").length;
  // The most people missing at any one time, as in the timeline's "Mangler (n)".
  const missing = Math.max(0, ...shifts.flatMap((s) => coverage.find((c) => c.shiftId === s.id)!.gaps.map((g) => s.helpersNeeded - g.have)));
  return { covered: coverage.every((c) => c.gaps.length === 0), accepted, declined, missing };
}

/** Shifts as offered in the answer form (helper and coordinator "Ret vagter"). */
export function shiftOptions(shifts: Shift[], eventDay: string) {
  return shifts.map((s) => ({
    id: s.id,
    name: shiftName(s),
    time: `${toDateInput(s.startsAt) !== eventDay ? `${formatShortDay(s.startsAt)} ` : ""}${shiftTimeText(s)}`,
    duration: s.durationMinutes != null ? formatDuration(s.durationMinutes) : null,
    suggestedDate: toDateInput(s.startsAt),
    suggestedStart: toTimeInput(s.startsAt),
  }));
}

/** An invitation's current answer, as the answer form's starting point. */
export function initialAnswer(availabilities: Availability[]) {
  return {
    picks: availabilities
      .filter((a) => a.shiftId)
      .map((a) => ({ id: a.shiftId!, date: toDateInput(a.startsAt), start: toTimeInput(a.startsAt) })),
    windows: availabilities
      .filter((a) => !a.shiftId)
      .map((a) => ({ date: toDateInput(a.startsAt), start: toTimeInput(a.startsAt), end: a.endsAt ? toTimeInput(a.endsAt) : null })),
  };
}

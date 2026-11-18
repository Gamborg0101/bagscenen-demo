import "server-only";
import type { Availability, GapApproval, InvitationStatus, PartialApproval, Shift } from "@prisma/client";
import type { NoteView } from "@/components/notes-log";
import { clipAndMerge, shiftCoverage, shiftRange, type ShiftCoverage } from "@/lib/coverage";
import { formatShortDay, formatStamp, toDateInput, toTimeInput } from "@/lib/datetime";
import { formatDuration } from "./form";
import { shiftName, shiftTimeText } from "./format";
import { hasRole, type CurrentUser } from "@/lib/session";
import { availabilityWindow, type EventInvitation, type EventNoteWithAuthor } from "./access";
import { withHolds, type HoldInvitation } from "./holds";

export function displayName(u: { firstName: string; lastName: string; anonymizedAt: Date | null } | null): string {
  if (!u || u.anonymizedAt) return "Tidligere medhjælper";
  return `${u.firstName} ${u.lastName}`;
}

/** Coverage for every shift, counting only helpers who have said yes. */
export type CoverageInvitation = { status: InvitationStatus; userId: string; availabilities: Availability[]; partialApproval?: PartialApproval | null };

/** Shifts loaded with `include: { gapApprovals: true }` also count the coordinator's approved gaps. */
export type CoverageShift = Shift & { gapApprovals?: GapApproval[] };

export function eventCoverage(shifts: CoverageShift[], invitations: CoverageInvitation[]): Map<string, ShiftCoverage> {
  const accepted = invitations.filter((i) => i.status === "ACCEPTED");
  const isDuration = (id: string | null) => !!id && shifts.some((s) => s.id === id && s.durationMinutes != null);

  return new Map(
    shifts.map((s) => {
      const helpers = accepted.map((i) => {
        // Measured against actual time windows (excluding duration-shift picks).
        const windows = i.availabilities.filter((a) => !isDuration(a.shiftId)).map((a) => availabilityWindow(a, shifts));
        if (s.durationMinutes == null) return { userId: i.userId, windows };
        // Duration shift: taking it covers it, whenever the helper chose to start;
        // so does being there anyway for the whole suggested window (e.g. an own time window 08–17).
        const range = shiftRange(s);
        const merged = clipAndMerge(windows, range);
        const there = merged.length === 1 && +merged[0].start === +range.start && +merged[0].end === +range.end;
        const took = i.availabilities.some((a) => a.shiftId === s.id);
        return { userId: i.userId, windows: took || there ? [{ start: s.startsAt, end: s.endsAt }] : [] };
      });
      const approvals = (s.gapApprovals ?? []).map((a) => ({ start: a.startsAt, end: a.endsAt, enough: a.enough }));
      return [s.id, shiftCoverage(s, helpers, approvals)];
    }),
  );
}

/** The invitations with pending partial answers holding the rest of their place (see holds.ts). */
export function heldInvitations(shifts: Shift[], invitations: HoldInvitation[]): HoldInvitation[] {
  return withHolds(shifts, invitations, eventCoverage);
}

export function staffingFrom(coverage: Map<string, ShiftCoverage>) {
  return Object.fromEntries(
    // "have": with an open gap, the fewest people there; otherwise the most there at once
    // (so two helpers taking turns count as one place).
    [...coverage].map(([id, c]) => [
      id,
      { have: c.gaps.length > 0 ? Math.min(...c.gaps.map((g) => g.have)) : c.peak, hasGaps: c.gaps.length > 0 },
    ]),
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
export function staffingSummary(shifts: CoverageShift[], invitations: CoverageInvitation[]) {
  if (shifts.length === 0) return null;
  const coverage = [...eventCoverage(shifts, invitations).values()];
  const accepted = invitations.filter((i) => i.status === "ACCEPTED").length;
  const declined = invitations.filter((i) => i.status === "DECLINED").length;
  const awaiting = invitations.filter((i) => i.status === "ACCEPTED" && i.partialApproval === "PENDING").length; // own time windows to approve
  // The most people missing at any one time, as in the timeline's "Mangler (n)".
  const missing = Math.max(0, ...shifts.flatMap((s) => coverage.find((c) => c.shiftId === s.id)!.gaps.map((g) => s.helpersNeeded - g.have)));
  return { covered: coverage.every((c) => c.gaps.length === 0), accepted, declined, missing, awaiting };
}

/** Shifts as offered in the answer form (helper and coordinator "Ret vagter"). */
export function shiftOptions(shifts: Shift[], eventDay: string, coverage: Map<string, ShiftCoverage>) {
  return shifts.map((s) => ({
    id: s.id,
    name: shiftName(s),
    time: `${toDateInput(s.startsAt) !== eventDay ? `${formatShortDay(s.startsAt)} ` : ""}${shiftTimeText(s)}`,
    duration: s.durationMinutes != null ? formatDuration(s.durationMinutes) : null,
    suggestedDate: toDateInput(s.startsAt),
    suggestedStart: toTimeInput(s.startsAt),
    capacity: shiftCapacity(s, coverage.get(s.id)!),
  }));
}

/** "full": no room left anywhere; "partly": the whole shift is taken, but own time windows can fill the gaps. */
function shiftCapacity(s: Shift, c: ShiftCoverage): "full" | "partly" | null {
  if (c.peak < s.helpersNeeded) return null;
  return c.gaps.length > 0 ? "partly" : "full";
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

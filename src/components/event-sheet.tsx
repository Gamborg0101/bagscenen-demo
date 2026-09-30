import { formatDay, formatRange, formatShortDay, toDateInput } from "@/lib/datetime";
import { shiftName, shiftTimeText } from "@/lib/events/format";
import { EVENT_STATUS_LABEL, EVENT_TYPE_LABEL } from "@/lib/events/labels";
import type { EventWithRelations } from "@/lib/events/queries";
import { requirementSections, type RequirementSection } from "@/lib/events/requirements";
import { formatEventRef } from "@/lib/events/ref";

type Staffing = Record<string, { have: number; hasGaps: boolean }>;

/** Read-only event overview shared by the admin and helper views. */
export function EventSheet({
  event,
  staffing,
  afterHeader,
  afterShifts,
  children,
}: {
  event: EventWithRelations;
  staffing?: Staffing;
  afterHeader?: React.ReactNode;
  afterShifts?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const eventDay = toDateInput(event.startsAt);
  const allRequirements = requirementSections(event);
  const requirements = allRequirements.filter((r) => r.title !== "Foyer");
  const foyer = allRequirements.find((r) => r.title === "Foyer");

  return (
    <article className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs text-muted">
          <span className="tabular-nums">{formatEventRef(event)}</span> · {EVENT_TYPE_LABEL[event.eventType]}
          {event.location && ` · ${event.location}`}
          {event.status !== "PUBLISHED" && (
            <span className={`ml-2 rounded border px-1.5 py-0.5 ${event.status === "CANCELLED" ? "border-danger text-danger" : "border-line"}`}>
              {EVENT_STATUS_LABEL[event.status]}
            </span>
          )}
        </p>
        <h1 className={`text-2xl font-semibold tracking-tight ${event.status === "CANCELLED" ? "line-through" : ""}`}>{event.title}</h1>
        <p>
          <span className="first-letter:uppercase inline-block">{formatDay(event.startsAt)}</span>
          <span className="text-muted"> · </span>
          <span className="tabular-nums">{formatRange(event.startsAt, event.endsAt)}</span>
        </p>
        {(event.expectedAttendees != null || event.helpersWanted != null) && (
          <p className="text-muted">
            {event.expectedAttendees != null && `${event.expectedAttendees} deltagere`}
            {event.expectedAttendees != null && event.helpersWanted != null && " · "}
            {event.helpersWanted != null && `${event.helpersWanted} ${event.helpersWanted === 1 ? "medhjælper" : "medhjælpere"} ønsket`}
          </p>
        )}
      </header>

      {afterHeader}

      {event.contacts.length > 0 && (
        <Section title="Kontakt">
          <ul className="divide-y divide-line border-y border-line">
            {event.contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name}</p>
                  {c.role && <p className="text-xs text-muted">{c.role}</p>}
                  {c.email && <p className="text-xs break-all select-all">{c.email}</p>}
                </div>
                <div className="flex gap-2">
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="rounded-md border border-line px-3 py-1.5 hover:bg-subtle">
                      Ring <span className="text-muted tabular-nums">{c.phone}</span>
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {event.shifts.length > 0 && (
        <Section title="Vagter">
          <ul className="divide-y divide-line border-y border-line">
            {event.shifts.map((s) => (
              <li key={s.id} className="flex items-baseline gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{shiftName(s)}</p>
                  {s.notes && <p className="text-xs text-muted">{s.notes}</p>}
                </div>
                <p className="text-right tabular-nums">
                  {toDateInput(s.startsAt) !== eventDay && <span className="text-muted">{formatShortDay(s.startsAt)} </span>}
                  {shiftTimeText(s)}
                  {s.durationMinutes != null && <span className="block text-xs text-muted">vælg selv starttid</span>}
                </p>
                <StaffingBadge needed={s.helpersNeeded} staffing={staffing?.[s.id]} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {afterShifts}

      {requirements.length > 0 && (
        <Section title="Teknik og opsætning">
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {requirements.map((r) => (
              <RequirementBlock key={r.title} section={r} />
            ))}
          </div>
        </Section>
      )}

      {foyer && (
        <Section title="Foyer">
          <RequirementBlock section={foyer} heading={false} />
        </Section>
      )}

      {event.generalNotes && (
        <Section title="Noter">
          <p className="whitespace-pre-wrap">{event.generalNotes}</p>
        </Section>
      )}

      {children}
    </article>
  );
}

function RequirementBlock({ section, heading = true }: { section: RequirementSection; heading?: boolean }) {
  return (
    <div className={heading ? "border-l-2 border-line pl-3" : ""}>
      {heading && <h3 className="mb-1 text-sm font-semibold">{section.title}</h3>}
      <ul className="space-y-0.5">
        {section.items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      {section.warnings.map((w) => (
        <p key={w} className="mt-1 font-semibold text-danger">
          {w}
        </p>
      ))}
      {section.notes.map((n, i) => (
        <p key={i} className="mt-2 rounded-md bg-subtle px-3 py-2 whitespace-pre-wrap">
          {n}
        </p>
      ))}
    </div>
  );
}

/** How full a shift is: a small filled bar plus "1/2". */
function StaffingBadge({ needed, staffing }: { needed: number; staffing?: { have: number; hasGaps: boolean } }) {
  if (!staffing) return <p className="w-24 text-right text-xs text-muted tabular-nums">{needed} pers.</p>;
  const full = !staffing.hasGaps;
  const tone = full ? "ok" : staffing.have === 0 ? "danger" : "warn";
  const pct = full ? 100 : Math.min(100, Math.round((staffing.have / Math.max(needed, 1)) * 100));
  return (
    <div className="flex w-24 shrink-0 items-center gap-2 self-center" title={full ? "Dækket" : "Mangler medhjælp"}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" role="img" aria-label={`${staffing.have} af ${needed} på`}>
        <div className={`h-full rounded-full ${tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : "bg-danger"}`} style={{ width: `${Math.max(pct, 0)}%` }} />
      </div>
      <span className={`text-xs tabular-nums ${tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-danger"}`}>
        {staffing.have}/{needed}
      </span>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

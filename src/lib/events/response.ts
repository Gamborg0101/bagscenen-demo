import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ugyldigt tidspunkt");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vælg en dato");

export const responseSchema = z
  .object({
    status: z.enum(["ACCEPTED", "DECLINED"]),
    // Whole shifts. For duration shifts the helper also gives their start (date + time).
    shifts: z.array(z.object({ id: z.string().max(40), date: date.nullable(), start: time.nullable() })).max(20),
    windows: z.array(z.object({ date, start: time, end: time.nullable() })).max(10),
  })
  .refine((r) => r.status === "DECLINED" || r.shifts.length + r.windows.length > 0, {
    path: ["shifts"],
    message: "Vælg mindst én vagt eller tilføj et tidsrum",
  });

export type ResponseInput = z.input<typeof responseSchema>;

export const noteSchema = z.string().trim().min(1, "Skriv en note").max(2000);

/** Answers lock 12 hours after the event ends. */
export function isEventLocked(e: { startsAt: Date; endsAt: Date | null }, now = Date.now()): boolean {
  return (e.endsAt ?? e.startsAt).getTime() + 12 * 3600_000 < now;
}

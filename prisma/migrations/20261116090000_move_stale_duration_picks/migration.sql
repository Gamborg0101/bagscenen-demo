-- Picks on duration shifts ("vælg selv starttid") store the start the helper chose. Before
-- `movedPicks`, moving an event left those picks on the old date. Move each pick that starts more
-- than 12 hours before its shift, or a day or more after it, by whole days so it lands in the
-- shift's first 24 hours with the chosen time of day kept. Idempotent: repaired picks are left alone.
UPDATE "Availability" AS a
SET "startsAt" = a."startsAt" + d.days * INTERVAL '1 day',
    "endsAt"   = a."endsAt"   + d.days * INTERVAL '1 day'
FROM (
  SELECT a2."id",
         CEIL(EXTRACT(EPOCH FROM (s."startsAt" - a2."startsAt")) / 86400)::int AS days
  FROM "Availability" a2
  JOIN "Shift" s ON s."id" = a2."shiftId"
  WHERE s."durationMinutes" IS NOT NULL
    AND (a2."startsAt" < s."startsAt" - INTERVAL '12 hours' OR a2."startsAt" >= s."startsAt" + INTERVAL '1 day')
) AS d
WHERE a."id" = d."id" AND d.days <> 0;

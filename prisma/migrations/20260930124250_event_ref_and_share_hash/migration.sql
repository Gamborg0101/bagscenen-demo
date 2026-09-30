-- Human-readable event ids ("2026-012"): year of the event date (Copenhagen) + running number per year.
ALTER TABLE "Event" ADD COLUMN "refYear" INTEGER;
ALTER TABLE "Event" ADD COLUMN "refNumber" INTEGER;

UPDATE "Event" e
SET "refYear" = r.y, "refNumber" = r.n
FROM (
  SELECT id,
         EXTRACT(YEAR FROM ("startsAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Copenhagen'))::int AS y,
         ROW_NUMBER() OVER (
           PARTITION BY EXTRACT(YEAR FROM ("startsAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Copenhagen'))
           ORDER BY "createdAt", id
         )::int AS n
  FROM "Event"
) r
WHERE e.id = r.id;

ALTER TABLE "Event" ALTER COLUMN "refYear" SET NOT NULL;
ALTER TABLE "Event" ALTER COLUMN "refNumber" SET NOT NULL;
CREATE UNIQUE INDEX "Event_refYear_refNumber_key" ON "Event"("refYear", "refNumber");

-- Channel plan share links remember what the plan looked like when the link was made.
ALTER TABLE "ChannelPlan" ADD COLUMN "shareHash" TEXT;

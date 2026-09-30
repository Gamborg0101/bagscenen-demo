-- Keep existing data: rename instead of drop + add.
ALTER TABLE "Event" RENAME COLUMN "lightweightTables" TO "tables";

-- Foyer used alongside Store sal / Lille sal
ALTER TABLE "Event" ADD COLUMN "foyerUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "foyerPodiums" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "foyerMics" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "foyerSound" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "foyerTables" INTEGER NOT NULL DEFAULT 0;

-- Group-chat invite links are no longer used
ALTER TABLE "EventInviteLink" DROP CONSTRAINT "EventInviteLink_eventId_fkey";
DROP TABLE "EventInviteLink";

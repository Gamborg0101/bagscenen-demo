-- Split the foyer podium text into size and height. Existing text is kept as the size.
ALTER TABLE "Event" RENAME COLUMN "foyerPodiumNotes" TO "foyerPodiumSize";
ALTER TABLE "Event" ADD COLUMN "foyerPodiumHeightCm" INTEGER;

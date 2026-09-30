-- DropForeignKey
ALTER TABLE "ProgramItem" DROP CONSTRAINT "ProgramItem_eventId_fkey";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "beerTap",
DROP COLUMN "cateringHelp",
DROP COLUMN "lavalierMics",
DROP COLUMN "podiumCount",
DROP COLUMN "tribunes",
DROP COLUMN "videoWithSound";

-- AlterTable
ALTER TABLE "Shift" DROP COLUMN "estimatedEnd",
ADD COLUMN     "durationMinutes" INTEGER;

-- DropTable
DROP TABLE "ProgramItem";


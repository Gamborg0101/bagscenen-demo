-- Inputs: one numbered stagebox range (AR2412 1–24 + chained AB168 as 25–40) or the mixer.
UPDATE "Channel" SET "inputNumber" = "inputNumber" + 24 WHERE "inputSource" = 'AB168';

CREATE TYPE "InputSource_new" AS ENUM ('STAGEBOX', 'MIXER');
ALTER TABLE "Channel" ALTER COLUMN "inputSource" TYPE "InputSource_new"
  USING (CASE WHEN "inputSource"::text IN ('AR2412', 'AB168') THEN 'STAGEBOX' ELSE "inputSource"::text END)::"InputSource_new";
DROP TYPE "InputSource";
ALTER TYPE "InputSource_new" RENAME TO "InputSource";

-- Public share links expire.
ALTER TABLE "ChannelPlan" ADD COLUMN "shareExpiresAt" TIMESTAMP(3);
UPDATE "ChannelPlan" SET "shareEnabled" = false WHERE "shareEnabled" = true;

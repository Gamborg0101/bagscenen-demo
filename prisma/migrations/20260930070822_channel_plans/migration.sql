-- CreateEnum
CREATE TYPE "PlanKind" AS ENUM ('EVENT', 'BAND');

-- CreateEnum
CREATE TYPE "Mixer" AS ENUM ('SQ7', 'SQ5', 'MACKIE');

-- CreateEnum
CREATE TYPE "DiType" AS ENUM ('NONE', 'MONO', 'STEREO');

-- CreateEnum
CREATE TYPE "InputSource" AS ENUM ('AR2412', 'AB168', 'MIXER');

-- CreateTable
CREATE TABLE "ChannelPlan" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" "PlanKind" NOT NULL,
    "name" TEXT NOT NULL,
    "mixer" "Mixer" NOT NULL DEFAULT 'SQ7',
    "sortKey" INTEGER NOT NULL DEFAULT 0,
    "shareEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shareVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "gear" TEXT,
    "di" "DiType" NOT NULL DEFAULT 'NONE',
    "phantom" BOOLEAN NOT NULL DEFAULT false,
    "inputSource" "InputSource",
    "inputNumber" INTEGER,
    "note" TEXT,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelPlan_eventId_idx" ON "ChannelPlan"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_planId_number_key" ON "Channel"("planId", "number");

-- AddForeignKey
ALTER TABLE "ChannelPlan" ADD CONSTRAINT "ChannelPlan_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ChannelPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

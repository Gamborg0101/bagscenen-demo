-- CreateTable
CREATE TABLE "GapApproval" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "enough" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GapApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GapApproval_shiftId_idx" ON "GapApproval"("shiftId");

-- AddForeignKey
ALTER TABLE "GapApproval" ADD CONSTRAINT "GapApproval_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TechRider" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechRider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TechRider_planId_key" ON "TechRider"("planId");

-- AddForeignKey
ALTER TABLE "TechRider" ADD CONSTRAINT "TechRider_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ChannelPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

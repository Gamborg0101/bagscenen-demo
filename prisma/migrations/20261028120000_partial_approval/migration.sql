-- CreateEnum
CREATE TYPE "PartialApproval" AS ENUM ('PENDING', 'REJECTED');

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "partialApproval" "PartialApproval";

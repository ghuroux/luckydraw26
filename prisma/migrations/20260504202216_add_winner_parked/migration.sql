-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'WINNER_PARKED';

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "wonAt" TIMESTAMP(3);

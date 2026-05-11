-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'USER_REACTIVATED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deactivatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "EmailLog_template_sentAt_idx" ON "EmailLog"("template", "sentAt");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

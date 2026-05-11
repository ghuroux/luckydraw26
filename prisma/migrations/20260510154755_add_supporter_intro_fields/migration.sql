-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "presentationStartedAt" TIMESTAMP(3),
ADD COLUMN     "showSupporterIntro" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showSupporterNames" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "DrawMode" AS ENUM ('PRIZE_DRAW', 'WINNER_DRAW');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "drawMode" "DrawMode" NOT NULL DEFAULT 'PRIZE_DRAW';

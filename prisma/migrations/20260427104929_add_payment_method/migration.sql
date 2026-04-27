-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD');

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "paymentMethod" "PaymentMethod";

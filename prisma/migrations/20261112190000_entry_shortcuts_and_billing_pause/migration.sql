-- CreateEnum
CREATE TYPE "AccountBillingStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN "billingStatus" "AccountBillingStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Account" ADD COLUMN "billingPausedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "entryShortcutByName" TEXT NOT NULL DEFAULT 'F4';
ALTER TABLE "User" ADD COLUMN "entryShortcutByCif" TEXT NOT NULL DEFAULT 'F6';
ALTER TABLE "User" ADD COLUMN "entryShortcutsConfigured" BOOLEAN NOT NULL DEFAULT false;

-- Las cuentas que ya estaban de alta no ven la ventana de atajos.
UPDATE "User" SET "entryShortcutsConfigured" = true;

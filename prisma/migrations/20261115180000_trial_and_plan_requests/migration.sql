-- Las cuentas que ya existen quedan ACTIVE: la prueba solo afecta a los registros nuevos.
CREATE TYPE "AccountAccessStatus" AS ENUM ('TRIAL', 'ACTIVE');

ALTER TABLE "Account"
  ADD COLUMN "accessStatus" "AccountAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "lifecycleNotices" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "requestedAccountType" "AccountType",
  ADD COLUMN "requestedTierId" TEXT,
  ADD COLUMN "planTierId" TEXT;

ALTER TABLE "User"
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsVersion" TEXT;

ALTER TABLE "pagos_pendientes"
  ADD COLUMN "plan_account_type" "AccountType",
  ADD COLUMN "plan_tier_id" TEXT,
  ADD COLUMN "plan_label" TEXT,
  ADD COLUMN "importe_euros" INTEGER;

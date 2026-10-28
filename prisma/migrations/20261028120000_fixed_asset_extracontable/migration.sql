CREATE TYPE "FixedAssetAdjustmentKind" AS ENUM ('NINGUNO', 'LIBRE_ACELERADA', 'ARRENDAMIENTO', 'LEY_16_2012');

ALTER TABLE "FixedAsset"
ADD COLUMN "adjustmentKind" "FixedAssetAdjustmentKind" NOT NULL DEFAULT 'NINGUNO',
ADD COLUMN "fiscalAnnualPercent" DECIMAL(6,2);

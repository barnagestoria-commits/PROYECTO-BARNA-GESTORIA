CREATE TYPE "CorporateTaxCharacter" AS ENUM (
  'SOCIEDAD',
  'ENTIDAD_CREDITO',
  'ASEGURADORA',
  'INVERSION_COLECTIVA',
  'GARANTIA_RECIPROCA',
  'NO_SUJETA'
);

ALTER TABLE "Company"
ADD COLUMN "corporateTaxCharacter" "CorporateTaxCharacter" NOT NULL DEFAULT 'SOCIEDAD',
ADD COLUMN "censusDocumentName" TEXT,
ADD COLUMN "censusDocumentKind" VARCHAR(32),
ADD COLUMN "censusExtractedAt" TIMESTAMP(3),
ADD COLUMN "censusExtractedJson" TEXT;

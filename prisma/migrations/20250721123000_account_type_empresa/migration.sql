-- Renombrar tipo de cuenta PYME → EMPRESA (si PYME ya existía en el enum)
ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'EMPRESA';

UPDATE "Account"
SET "accountType" = 'EMPRESA'
WHERE "accountType"::text = 'PYME';

-- Migrar cuentas PYME → EMPRESA (solo si PYME existía en el enum).
UPDATE "Account"
SET "accountType" = 'EMPRESA'
WHERE "accountType"::text = 'PYME';

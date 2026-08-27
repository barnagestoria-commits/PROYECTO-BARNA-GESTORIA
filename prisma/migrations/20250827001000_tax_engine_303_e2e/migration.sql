-- Unificar la clave normativa con el identificador inmutable del registro de fuentes.
UPDATE "TaxModelVersion"
SET
  "versionKey" = 'AEAT:303:2026:DR303e26v101',
  "sourceLabel" = 'DR303e26v101 — IVA autoliquidación 2026',
  "sha256Prefix" = '0be8b156'
WHERE "versionKey" = 'AEAT:303:2026:TRIM:101';

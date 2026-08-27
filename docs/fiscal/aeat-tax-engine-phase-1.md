# Motor tributario AEAT — Fase 1 (implementación inicial)

**Rama:** `cursor/aeat-303-end-to-end`
**Alcance:** paquete `@gestoria/tax-engine`, adaptador **303 DR303**, PDF/UI, trazabilidad, persistencia y exportación fiscal.

## Qué está implementado

1. **`packages/tax-engine`** — núcleo TypeScript puro:
   - `AeatSourceRegistry` con fuentes oficiales 303/2026
   - `TaxFactLedger` + `TaxRuleEngine` (casillas 303)
   - Adaptador `exportModel303Dr303` conforme a **DR303e26v101** (envolvente `<T3030…>`, páginas 01000 + 03000)
   - Validación estructural del fichero generado

2. **Integración app** (`lib/fiscal/aeat/`):
   - `tax-engine-bridge.ts` — conecta panorama fiscal → tax-engine
   - `generate-aeat-txt.ts` — **303** usa DR303; otros modelos siguen en legacy BOE-500 (pendiente Fase 2)
   - `generate-aeat-txt-legacy.ts` — exportador anterior aislado y marcado deprecated
   - `validate-submission.ts` — validación DR303 para el 303

3. **Persistencia** (migración `20250827000000_tax_engine_phase1`):
   - `TaxModelVersion`, `TaxModelSource`, `TaxReturn`, `TaxFact`, `TaxExportArtifact`, etc.
   - Versión inmutable `AEAT:303:2026:DR303e26v101`
   - Casillas y referencias contables en `TaxReturnValueSource`
   - Validación, hash SHA-256 del export y eventos de auditoría

4. **Flujo visual end-to-end**:
   - El PDF oficial recibe las mismas casillas que el exportador DR303.
   - La pantalla muestra versión, fuente oficial, validación y trazabilidad.
   - La descarga **Fichero AEAT .303** persiste el borrador y el artefacto exportado.
   - Si existe un asiento de liquidación, el detalle se reconstruye desde los asientos origen.

## Cómo probar

```bash
npm test -- packages/tax-engine/src/__tests__/model-303-adapter.test.ts
npm test -- lib/fiscal/__tests__/generate-aeat-txt-303.test.ts
npm run db:migrate   # aplica tablas tax_*
npm run dev          # UI → exportar modelo 303 trimestral → descarga .303
```

## Pendiente (Fase 1 restante / Fase 2)

- Adaptadores 111, 115, 130 (diseños BOE 500/600 pos.)
- Páginas 02000, 04000, 05000, DID del 303 (régimen simplificado, prorrata, domiciliación)
- Almacenamiento object storage de binarios oficiales
- Presentación AEAT real (certificado + confirmación humana)

## Referencia Fase 0

Ver [aeat-tax-engine-phase-0.md](./aeat-tax-engine-phase-0.md).

# Motor tributario AEAT — Fase 0 (auditoría y diseño)

**Fecha de corte:** 27-08-2026  
**Rama:** `cursor/aeat-tax-engine-phase-0`  
**Alcance:** auditoría, fuentes oficiales, arquitectura y plan. **Sin implementación de Fase 1.**

## Resumen ejecutivo

El repositorio es **Next.js 15 + TypeScript + Prisma/PostgreSQL**, no Laravel. Existe un pipeline fiscal parcial (`lib/fiscal/`) con panorama, borradores, PDF overlay y exportación TXT, pero el exportador en `lib/fiscal/aeat/generate-aeat-txt.ts` **no cumple** los diseños oficiales AEAT (usa registros genéricos 1/2/9 de 500 caracteres; los diseños publicados usan envolvente variable y páginas posicionales distintas por modelo).

**Decisión recomendada:** extraer `@gestoria/tax-engine` como paquete TS puro; implementar primero un **303 vertical completo** con versionado normativo, libros LSI 2026 y diseño `DR303e26v101`.

## Bloqueador antes de Fase 1

- Deshabilitar o renombrar la exportación telemática actual hasta tener adaptador conforme al diseño oficial.
- No marcar PDF borrador como declaración presentada.
- No llamar a producción AEAT en pruebas.

## Fuentes oficiales verificadas (SHA-256, descarga 27-08-2026)

| Ámbito | Recurso | Fecha oficial | SHA-256 (prefijo) | URL |
|--------|---------|---------------|-------------------|-----|
| 303 | Diseño 2026+ | 28-01-2026 | `0be8b156…` | [DR303e26v101.xlsx](https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/DR_300_399/archivos_26/DR303e26v101.xlsx) |
| 303 | Cálculo Pre303 | 01-01-2026 | `700a42a3…` | [CALCULO_CASILLAS_IVA_PRE303-LSI.xlsx](https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/IVA/Fact_registro/Libros_registro/CALCULO_CASILLAS_IVA_PRE303-LSI.xlsx) |
| 130 | Traslado libros → casillas | 01-01-2026 | `19389f89…` | [Traslado_Libros_a_Casillas_130.xlsx](https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/IVA/Fact_registro/Libros_registro/Traslado_Libros_a_Casillas_130.xlsx) |
| Libros | LSI / LSIJ | 01-01-2026 | `d35e92f2…` / `963e653c…` | [LSI.xlsx](https://sede.agenciatributaria.gob.es/static_files/AEAT/LSI.xlsx) |
| 111 / 115 / 130 | Diseños registro | varios | ver índice | [Modelos 100–199](https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro/modelos-100-199.html) |
| 100 | Renta 2025 XSD | 24-06-2026 | `df94cc51…` | [Renta2025.xsd](https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/DR_100_199/Renta2025.xsd) |

Índices históricos: [ejercicios anteriores 100–199](https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro/ejercicios-anteriores-modelos-100-199.html), [300–399](https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro/ejercicios-anteriores-modelos-300-399.html).

Los binarios oficiales deben almacenarse en object storage versionado; metadatos y hashes en PostgreSQL (`tax_model_sources`).

## Matriz de modelos (prioridad Fase 1–2)

| Ola | Modelo | Formato | Canal |
|-----|--------|---------|-------|
| 1 | 303 | BOE + libros LSI | Pre303 / importación |
| 2 | 130, 111, 115 | BOE 600/500 pos. | Formulario / importación |
| 3 | 180, 190, 347, 349, 390 | TGVI / informativas | Formulario / TGVI Online |
| 4+ | 100, 200, SII, VERI*FACTU | XSD/XML/WSDL | Renta WEB / servicios web |

## Arquitectura objetivo (`@gestoria/tax-engine`)

```
AccountingEntry → TaxFactLedger → TaxRuleEngine → TaxReturnDraft
  → TaxValidationEngine → TaxModelAdapter → TaxExportArtifact
  → (opcional) AeatSubmissionGateway con confirmación humana
```

Entidades Prisma planificadas: `tax_models`, `tax_model_versions`, `tax_model_sources`, `tax_facts`, `tax_returns`, `tax_return_values`, `tax_return_value_sources`, `tax_validation_results`, `tax_export_artifacts`, `tax_submission_attempts`, `tax_audit_events`, etc.

## Plan Fase 1 (commits verificables)

1. Salvaguarda exportador genérico + tests de regresión.
2. `AeatSourceRegistry` + almacenamiento versionado de fuentes.
3. Catálogo y definiciones inmutables por `AEAT:{modelo}:{ejercicio}:{periodo}:{revision}`.
4. `TaxFactLedger` + Decimal end-to-end.
5. Adaptador **303** con golden files contra diseño oficial.
6. UI trazabilidad casilla → hecho → asiento (ampliar existente).
7. Documentación operativa para añadir modelos.

## Qué reutilizar del código actual

- `RawEntryLine` / `panorama-service` como adaptador de lectura.
- `fiscal-line-detection`, `iva-bridge-summary`, layouts en `official-layouts/`.
- UI: `FiscalModelDraftView`, `FiscalCalculationDetailDialog`.
- Importadores A3 (convenciones `IVA S./`, `Reten./`).

## Artefacto visual

Informe interactivo (Cursor Canvas, fuera del repo):  
`~/.cursor/projects/Users-soniamac-PROYECTO-BARNA-GESTORIA/canvases/fase-0-motor-tributario-AEAT.canvas.tsx`

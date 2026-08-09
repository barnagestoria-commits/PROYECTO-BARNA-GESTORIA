# Mapeo de casillas AEAT — extracción desde PDF justificante

Documento de referencia para `scripts/extract-aeat-pdf.py`.  
**No persiste datos** en base de datos; solo estructura de lectura.

---

## Modelo 111 — Retenciones IRPF trimestral

Identificación: `{NIF} {RAZÓN SOCIAL}` + `{EJERCICIO} {PERÍODO}` tras `Número (de) justificante`.

| Fila | Casillas | Formato línea |
|-----:|----------|---------------|
| 1–5 | 01–15 (tripletas) | `{perceptores} {percepciones} {retenciones}` |
| totales | 28, 29, 30 | importe suelto por línea |

Validación: `[28] = Σ retenciones de filas informadas`.

---

## Modelo 123 — Retenciones capital mobiliario trimestral

| Orden | Casillas | Formato |
|------:|----------|---------|
| 1 | 01, 04 | `{nº rentas div} {nº rentas resto}` |
| 2 | 02, 05 | `{base div} {base resto}` |
| 3 | 03, 06 | `{retención div} {retención resto}` |
| 4–6 | 09, 11, 14 | importes sueltos (totales / resultado) |

---

## Modelo 303 — IVA trimestral

Pág. 2: secuencia posicional (triple 01/03, pares 04–41, singles 27/45/46).  
Pág. 3: 62, 63, 110, 78, 71 (priorizar NRC para `[71]`).

Validación: `[46]=[27]−[45]`, `[71]≈NRC`.

---

## Modelo 349 — Recapitulativa intracomunitaria trimestral

Resumen tras justificante:

| Casilla | Campo |
|--------:|-------|
| 01 | Número total de operadores |
| 02 | Importe total operaciones intracomunitarias |

Detalle (pág. interior): `{PAÍS} {NIF-IVA} {NOMBRE} {CLAVE} {BASE}` por operador.

---

## Modelo 390 — Resumen anual IVA

| Bloque | Casillas | Extracción |
|--------|----------|------------|
| Devengado 21% | 01, 03, 27 | Par base/cuota con ratio ≈ 21% |
| Liquidación pág. 6 | 47, 64, 65 | Dos importes antes de autenticidad |
| Resultado / volumen pág. 7 | 84, 658, 86, 71, 99, 103, 653, 108 | 8 importes tras «Total volumen de operaciones» |

Validación: `[65]=[47]−[64]`.

---

## Modelo 347 — Operaciones con terceros (anual)

Resumen final: `{total declarados}` + `{importe total anual}`.

Detalle por declarado:

| Tipo | Patrón |
|------|--------|
| Nacional | `{NIF} {NOMBRE}` → `{PROV} {CLAVE}` → `{IMPORTE}` |
| Extranjero | `{NOMBRE}` → `{PROV} {PAÍS} {CLAVE}` → `{IMPORTE}` |

---

## Modelo 190 — Retenciones anuales IRPF

Resumen: 01 (nº perceptores), 02 (percepciones), 03 (retenciones).

Detalle por perceptor: `{NIF} {NOMBRE} {PROV}` → `{SIT} {CLAVE}` o `{CLAVE}` → `{percepción} [retención]`.

---

## Modelo 193 — Retenciones capital mobiliario (anual)

Resumen: 01 (perceptores), 02 (base), 03 (retenciones), 04 (ingresadas).

Detalle: `{NIF} {NOMBRE} {PROV}` → metadatos → `{base} {tipo%} {retención}`.

---

## Modelo 200 — Impuesto sobre Sociedades (anual)

Bloque final MINISTERIO DE HACIENDA:

| Orden | Casilla aprox. | Concepto |
|------:|----------------|----------|
| 1 | 00548 | Base imponible |
| 2 | 00562 | Cuota íntegra |
| 3 | 00585 | Resultado a ingresar |

Incluye periodo impositivo e IBAN si domiciliación.

---

## Modelo 202 — Pagos fraccionados IS

Tras `{EJERCICIO} {PERÍODO}` y `{FECHA INICIO}`:

| Casilla | Campo |
|--------:|-------|
| 01 | Base imponible último periodo impositivo |
| 03 | Cuota resultante (18% modalidad 40.2) |
| 34 | Importe a ingresar (= cuota) |

---

## Uso

```bash
.venv-pdf/bin/python3 scripts/extract-aeat-pdf.py ruta/al/justificante.pdf
```

Salida JSON a stdout. Flag `--output-dir` solo para depuración local.

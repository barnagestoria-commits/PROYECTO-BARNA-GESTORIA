import type { FiscalModelDetailResponse, FiscalModelBreakdownLine } from "@/lib/types/fiscal-panorama"
import type { DraftSection } from "@/lib/fiscal/model-draft/types"
import {
  casillaAmount,
  countPerceptores,
  deriveBaseFromRetention,
  hasLiquidation,
  round2,
  sectionTotal,
  sumContributing,
} from "@/lib/fiscal/official-layouts/shared"

function retentionFromLines(
  detail: FiscalModelDetailResponse,
  filter: (line: FiscalModelBreakdownLine) => boolean,
): { perceptores: number; retenciones: number; base: number } {
  const lines = detail.breakdown.flatMap((section) => section.lines).filter((line) => line.category === "contributing")
  const matched = lines.filter(filter)
  const perceptores = new Set(
    matched.map((line) => (line.nif?.trim() || line.entryId).toUpperCase()),
  ).size
  const retenciones = round2(matched.reduce((sum, line) => sum + line.signedAmount, 0))
  return { perceptores, retenciones, base: deriveBaseFromRetention(retenciones) }
}

function isDividendLine(line: FiscalModelBreakdownLine): boolean {
  const text = `${line.concepto} ${line.entryConcept ?? ""}`
  return /RETENCI[ÓO]N\s+DIVID|RET\.?\s*DIVID|DIVIDENDOS/i.test(text)
}

function isRentalLine(line: FiscalModelBreakdownLine): boolean {
  const text = `${line.concepto} ${line.entryConcept ?? ""}`
  if (isDividendLine(line)) return false
  return /4732/.test(line.cuenta.replace(/\D/g, "")) || /ALQUILER|ARREND|INMUEBLE|URBAN/i.test(text)
}

function isWorkLine(line: FiscalModelBreakdownLine): boolean {
  const text = `${line.concepto} ${line.entryConcept ?? ""}`
  if (isDividendLine(line) || isRentalLine(line)) return false
  return /Reten[\.\/]|Retenc|RETENCI/i.test(text)
}

export function buildOfficialModel111Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const work = retentionFromLines(detail, () => true)
  const totalRetenciones = hasLiquidation(detail) ? detail.amount : sumContributing(detail) || detail.amount
  const perceptores = countPerceptores(detail) || work.perceptores
  const base = deriveBaseFromRetention(totalRetenciones)

  return [
    {
      id: "rendimientos-trabajo",
      title: "I. Rendimientos del trabajo",
      casillas: [
        casillaAmount("111-01", "01", "Número de perceptores", perceptores, "retenciones"),
        casillaAmount("111-02", "02", "Importe de las percepciones", base, "retenciones"),
        casillaAmount("111-03", "03", "Retenciones e ingresos a cuenta", totalRetenciones, "retenciones"),
      ],
    },
    {
      id: "actividades-profesionales",
      title: "II. Rendimientos de actividades profesionales",
      casillas: [
        casillaAmount("111-04", "04", "Número de perceptores", 0, "retenciones"),
        casillaAmount("111-05", "05", "Importe de las percepciones", 0, "retenciones"),
        casillaAmount("111-06", "06", "Retenciones e ingresos a cuenta", 0, "retenciones"),
      ],
    },
    {
      id: "premios",
      title: "III. Premios por participación en juegos, concursos y sorteos",
      casillas: [
        casillaAmount("111-07", "07", "Número de perceptores", 0, "retenciones"),
        casillaAmount("111-08", "08", "Importe de las percepciones", 0, "retenciones"),
        casillaAmount("111-09", "09", "Retenciones e ingresos a cuenta", 0, "retenciones"),
      ],
    },
    {
      id: "resultado",
      title: "IV. Resultado de la declaración",
      casillas: [
        casillaAmount(
          "111-13",
          "13",
          "Suma de retenciones e ingresos a cuenta ([03]+[06]+[09]+…)",
          totalRetenciones,
          "retenciones",
        ),
        casillaAmount("111-15", "15", "Total a ingresar", totalRetenciones, "retenciones", "Resultado del periodo"),
      ],
    },
  ]
}

export function buildOfficialModel115Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const totalRetenciones = hasLiquidation(detail)
    ? detail.amount
    : sectionTotal(detail, "retenciones") || sumContributing(detail) || detail.amount
  const perceptores = countPerceptores(detail)
  const base = deriveBaseFromRetention(totalRetenciones, 0.19)

  return [
    {
      id: "arrendamientos",
      title: "Retenciones e ingresos a cuenta — Arrendamiento de inmuebles urbanos",
      casillas: [
        casillaAmount("115-01", "01", "Número de perceptores", perceptores, "retenciones"),
        casillaAmount("115-02", "02", "Base de las retenciones e ingresos a cuenta", base, "retenciones"),
        casillaAmount("115-03", "03", "Retenciones e ingresos a cuenta practicados", totalRetenciones, "retenciones"),
        casillaAmount("115-04", "04", "Total a ingresar", totalRetenciones, "retenciones", "Resultado del periodo"),
      ],
    },
  ]
}

export function buildOfficialModel130Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const total = Math.abs(detail.amount)
  const hasActivity = detail.breakdown.some((section) => section.key === "ingresos" || section.key === "gastos")
  const resultado = detail.breakdown.find((section) => section.key === "resultado")?.total

  if (!hasActivity) {
    return [
      {
        id: "pago-fraccionado",
        title: "Pago fraccionado — Estimación directa",
        casillas: [
          casillaAmount("130-07", "07", "Pago fraccionado del periodo", total, "liquidacion"),
          casillaAmount("130-19", "19", "Total a ingresar", resultado ?? total, "resultado", "Resultado del periodo"),
        ],
      },
    ]
  }

  const c07 = sectionTotal(detail, "pago-fraccionado")
  const c11 = 0
  const c12 = c07 + c11 > 0 ? round2(c07 + c11) : 0
  const c14 = sectionTotal(detail, "diferencia")
  const c15 = sectionTotal(detail, "resultados-negativos")
  const c16 = 0
  const c17 = round2(c14 - c15 - c16)
  const c19 = resultado ?? c17

  return [
    {
      id: "estimacion-directa",
      title: "I. Actividades económicas en estimación directa",
      casillas: [
        casillaAmount("130-01", "01", "Ingresos computables", sectionTotal(detail, "ingresos"), "ingresos"),
        casillaAmount("130-02", "02", "Gastos fiscalmente deducibles", sectionTotal(detail, "gastos"), "gastos"),
        casillaAmount("130-03", "03", "Rendimiento neto (01 − 02)", sectionTotal(detail, "rendimiento"), "rendimiento"),
        casillaAmount("130-04", "04", "20 % de la casilla 03", sectionTotal(detail, "cuota"), "cuota"),
        casillaAmount(
          "130-05",
          "05",
          "Pagos fraccionados de trimestres anteriores",
          sectionTotal(detail, "pagos-previos"),
          "pagos-previos",
        ),
        casillaAmount(
          "130-06",
          "06",
          "Retenciones e ingresos a cuenta soportados",
          sectionTotal(detail, "retenciones-soportadas"),
          "retenciones-soportadas",
        ),
        casillaAmount("130-07", "07", "Pago fraccionado previo (04 − 05 − 06)", c07, "pago-fraccionado"),
      ],
    },
    {
      id: "total-liquidacion",
      title: "III. Total liquidación",
      casillas: [
        casillaAmount("130-12", "12", "Suma de pagos fraccionados del trimestre", c12, "pago-fraccionado"),
        casillaAmount(
          "130-13",
          "13",
          "Minoración art. 110.3 del Reglamento del IRPF",
          sectionTotal(detail, "minoracion"),
          "minoracion",
        ),
        casillaAmount("130-14", "14", "Diferencia (12 − 13)", c14, "diferencia"),
        casillaAmount(
          "130-15",
          "15",
          "Resultados negativos de trimestres anteriores",
          c15,
          "resultados-negativos",
        ),
        casillaAmount("130-16", "16", "Deducción por vivienda habitual", c16, "resultado"),
        casillaAmount("130-17", "17", "Total (14 − 15 − 16)", c17, "resultado"),
        casillaAmount("130-18", "18", "Resultado de liquidaciones anteriores", 0, "resultado"),
        casillaAmount("130-19", "19", "Resultado de la autoliquidación", c19, "resultado", "Resultado del periodo"),
      ],
    },
  ]
}

export function buildOfficialModel123Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const totalRetenciones = hasLiquidation(detail)
    ? detail.amount
    : sectionTotal(detail, "retenciones-dividendos") || sumContributing(detail) || detail.amount
  const perceptores = countPerceptores(detail)
  const base = deriveBaseFromRetention(totalRetenciones, 0.19)

  return [
    {
      id: "capital-mobiliario",
      title: "Retenciones e ingresos a cuenta del capital mobiliario",
      casillas: [
        casillaAmount("123-01", "01", "Número de perceptores", perceptores, "retenciones-dividendos"),
        casillaAmount("123-02", "02", "Base de retenciones e ingresos a cuenta", base, "retenciones-dividendos"),
        casillaAmount("123-03", "03", "Intereses y demás rendimientos del capital mobiliario", 0, "retenciones-dividendos"),
        casillaAmount("123-04", "04", "Dividendos y otras participaciones en beneficios", totalRetenciones, "retenciones-dividendos"),
        casillaAmount("123-05", "05", "Total retenciones e ingresos a cuenta ([03]+[04])", totalRetenciones, "retenciones-dividendos"),
        casillaAmount("123-06", "06", "Total a ingresar", totalRetenciones, "retenciones-dividendos", "Resultado del periodo"),
      ],
    },
  ]
}

export function buildOfficialModel180Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const totalRetenciones = hasLiquidation(detail)
    ? detail.amount
    : sectionTotal(detail, "retenciones-alquiler") || sumContributing(detail) || detail.amount
  const perceptores = countPerceptores(detail)
  const base = deriveBaseFromRetention(totalRetenciones, 0.19)

  return [
    {
      id: "resumen-anual-alquileres",
      title: "Resumen anual — Retenciones e ingresos a cuenta de arrendamientos",
      casillas: [
        casillaAmount("180-01", "01", "Número total de perceptores", perceptores, "retenciones-alquiler"),
        casillaAmount("180-02", "02", "Importe total de las percepciones", base, "retenciones-alquiler"),
        casillaAmount(
          "180-03",
          "03",
          "Total retenciones e ingresos a cuenta practicados",
          totalRetenciones,
          "retenciones-alquiler",
          "Declaración informativa anual",
        ),
      ],
    },
  ]
}

export function buildOfficialModel190Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const work = retentionFromLines(detail, isWorkLine)
  const rental = retentionFromLines(detail, isRentalLine)
  const dividends = retentionFromLines(detail, isDividendLine)

  const totalRetenciones = hasLiquidation(detail)
    ? detail.amount
    : sectionTotal(detail, "retenciones-anuales") || sumContributing(detail) || detail.amount

  const workRet =
    work.retenciones || (rental.retenciones + dividends.retenciones === 0 ? totalRetenciones : work.retenciones)
  const rentalRet = rental.retenciones
  const dividendRet = dividends.retenciones

  return [
    {
      id: "rendimientos-trabajo",
      title: "A. Rendimientos del trabajo",
      casillas: [
        casillaAmount("190-01", "01", "Número de perceptores", work.perceptores, "retenciones-anuales"),
        casillaAmount("190-02", "02", "Importe de las percepciones", work.base, "retenciones-anuales"),
        casillaAmount("190-03", "03", "Retenciones e ingresos a cuenta — trabajo", workRet, "retenciones-anuales"),
      ],
    },
    {
      id: "actividades-profesionales",
      title: "B. Rendimientos de actividades profesionales",
      casillas: [
        casillaAmount("190-04", "04", "Número de perceptores", 0, "retenciones-anuales"),
        casillaAmount("190-05", "05", "Importe de las percepciones", 0, "retenciones-anuales"),
        casillaAmount("190-06", "06", "Retenciones e ingresos a cuenta", 0, "retenciones-anuales"),
      ],
    },
    {
      id: "arrendamientos",
      title: "C. Rendimientos de arrendamientos",
      casillas: [
        casillaAmount("190-10", "10", "Número de perceptores", rental.perceptores, "retenciones-anuales"),
        casillaAmount("190-11", "11", "Importe de las percepciones", rental.base, "retenciones-anuales"),
        casillaAmount("190-12", "12", "Retenciones e ingresos a cuenta", rentalRet, "retenciones-anuales"),
      ],
    },
    {
      id: "capital-mobiliario",
      title: "D. Rendimientos del capital mobiliario",
      casillas: [
        casillaAmount("190-07", "07", "Número de perceptores", dividends.perceptores, "retenciones-anuales"),
        casillaAmount("190-08", "08", "Importe de las percepciones", dividends.base, "retenciones-anuales"),
        casillaAmount("190-09", "09", "Retenciones e ingresos a cuenta", dividendRet, "retenciones-anuales"),
      ],
    },
    {
      id: "resultado",
      title: "E. Resumen anual",
      casillas: [
        casillaAmount(
          "190-13",
          "13",
          "Total retenciones e ingresos a cuenta practicados",
          totalRetenciones,
          "retenciones-anuales",
          "Declaración informativa anual",
        ),
      ],
    },
  ]
}

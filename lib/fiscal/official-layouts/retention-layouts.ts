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
  const perceptores = new Set(matched.map((line) => line.entryId)).size
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

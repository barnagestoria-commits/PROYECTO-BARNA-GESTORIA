import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import type { DraftCasilla, DraftSection } from "@/lib/fiscal/model-draft/types"

export interface Model303CasillaValues {
  base01: number
  cuota03: number
  base04: number
  cuota06: number
  base07: number
  cuota09: number
  base10: number
  cuota11: number
  base12: number
  cuota13: number
  cuota27: number
  base28: number
  cuota29: number
  base30: number
  cuota31: number
  base32: number
  cuota33: number
  base34: number
  cuota35: number
  base36: number
  cuota37: number
  base38: number
  cuota39: number
  cuota45: number
  cuota46: number
  cuota110: number
  cuota71: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function emptyCasillas(): Model303CasillaValues {
  return {
    base01: 0,
    cuota03: 0,
    base04: 0,
    cuota06: 0,
    base07: 0,
    cuota09: 0,
    base10: 0,
    cuota11: 0,
    base12: 0,
    cuota13: 0,
    cuota27: 0,
    base28: 0,
    cuota29: 0,
    base30: 0,
    cuota31: 0,
    base32: 0,
    cuota33: 0,
    base34: 0,
    cuota35: 0,
    base36: 0,
    cuota37: 0,
    base38: 0,
    cuota39: 0,
    cuota45: 0,
    cuota46: 0,
    cuota110: 0,
    cuota71: 0,
  }
}

function normalizeAccount(cuenta: string): string {
  return cuenta.replace(/\D/g, "")
}

function isIncomeBaseAccount(cuenta: string): boolean {
  return normalizeAccount(cuenta).startsWith("7")
}

function isExpenseBaseAccount(cuenta: string): boolean {
  const digits = normalizeAccount(cuenta)
  return digits.startsWith("6") || digits.startsWith("2")
}

function isRepercutidoAccount(cuenta: string): boolean {
  return normalizeAccount(cuenta).startsWith("477")
}

function isSoportadoAccount(cuenta: string): boolean {
  return normalizeAccount(cuenta).startsWith("472")
}

function inferRateBucket(base: number, cuota: number): "21" | "10" | "4" {
  if (base <= 0 || cuota <= 0) return "21"
  const rate = cuota / base
  if (rate >= 0.19 && rate <= 0.22) return "21"
  if (rate >= 0.09 && rate <= 0.11) return "10"
  if (rate >= 0.03 && rate <= 0.05) return "4"
  return "21"
}

function isIntracomunitariaText(text: string): boolean {
  return /intracomunit|intra\s*com|ue\b|comunitari/i.test(text)
}

function isInversionSujetoPasivo(text: string): boolean {
  return /inversi[oó]n del sujeto pasivo|suplido|isp\b/i.test(text)
}

function assignDevengadoBucket(
  values: Model303CasillaValues,
  base: number,
  cuota: number,
  context: string,
): void {
  if (isInversionSujetoPasivo(context)) {
    values.base12 = round2(values.base12 + base)
    values.cuota13 = round2(values.cuota13 + cuota)
    return
  }
  if (isIntracomunitariaText(context)) {
    values.base10 = round2(values.base10 + base)
    values.cuota11 = round2(values.cuota11 + cuota)
    return
  }

  const bucket = inferRateBucket(base, cuota)
  if (bucket === "10") {
    values.base04 = round2(values.base04 + base)
    values.cuota06 = round2(values.cuota06 + cuota)
  } else if (bucket === "4") {
    values.base07 = round2(values.base07 + base)
    values.cuota09 = round2(values.cuota09 + cuota)
  } else {
    values.base01 = round2(values.base01 + base)
    values.cuota03 = round2(values.cuota03 + cuota)
  }
}

function assignDeducibleBucket(
  values: Model303CasillaValues,
  base: number,
  cuota: number,
  context: string,
  isInvestment: boolean,
): void {
  if (isIntracomunitariaText(context)) {
    if (isInvestment) {
      values.base38 = round2(values.base38 + base)
      values.cuota39 = round2(values.cuota39 + cuota)
    } else {
      values.base36 = round2(values.base36 + base)
      values.cuota37 = round2(values.cuota37 + cuota)
    }
    return
  }

  if (/import/i.test(context)) {
    if (isInvestment) {
      values.base34 = round2(values.base34 + base)
      values.cuota35 = round2(values.cuota35 + cuota)
    } else {
      values.base32 = round2(values.base32 + base)
      values.cuota33 = round2(values.cuota33 + cuota)
    }
    return
  }

  if (isInvestment) {
    values.base30 = round2(values.base30 + base)
    values.cuota31 = round2(values.cuota31 + cuota)
  } else {
    values.base28 = round2(values.base28 + base)
    values.cuota29 = round2(values.cuota29 + cuota)
  }
}

function deriveBaseFromCuota(cuota: number, rate = 0.21): number {
  if (cuota === 0) return 0
  return round2(cuota / rate)
}

function analyzeEntryLines(
  lines: FiscalModelDetailResponse["breakdown"][number]["lines"],
): Model303CasillaValues {
  const values = emptyCasillas()
  const byEntry = new Map<string, typeof lines>()

  for (const line of lines) {
    const current = byEntry.get(line.entryId) ?? []
    current.push(line)
    byEntry.set(line.entryId, current)
  }

  for (const entryLines of byEntry.values()) {
    const context = entryLines.map((line) => `${line.concepto} ${line.entryConcept ?? ""}`).join(" ")
    const repercutidoCuota = round2(
      entryLines
        .filter((line) => isRepercutidoAccount(line.cuenta))
        .reduce((sum, line) => sum + Math.max(0, line.haber - line.debe), 0),
    )
    const soportadoCuota = round2(
      entryLines
        .filter((line) => isSoportadoAccount(line.cuenta))
        .reduce((sum, line) => sum + Math.max(0, line.debe - line.haber), 0),
    )
    const incomeBase = round2(
      entryLines
        .filter((line) => isIncomeBaseAccount(line.cuenta))
        .reduce((sum, line) => sum + Math.max(0, line.haber - line.debe), 0),
    )
    const expenseBase = round2(
      entryLines
        .filter((line) => isExpenseBaseAccount(line.cuenta))
        .reduce((sum, line) => sum + Math.max(0, line.debe - line.haber), 0),
    )
    const isInvestment = entryLines.some((line) => normalizeAccount(line.cuenta).startsWith("2"))

    if (repercutidoCuota > 0) {
      assignDevengadoBucket(values, incomeBase || deriveBaseFromCuota(repercutidoCuota), repercutidoCuota, context)
    }
    if (soportadoCuota > 0) {
      assignDeducibleBucket(
        values,
        expenseBase || deriveBaseFromCuota(soportadoCuota),
        soportadoCuota,
        context,
        isInvestment,
      )
    }
  }

  return values
}

function applyAggregateFallback(
  values: Model303CasillaValues,
  repercutido: number,
  soportado: number,
): Model303CasillaValues {
  const next = { ...values }

  if (repercutido > 0 && next.cuota03 + next.cuota06 + next.cuota09 + next.cuota11 + next.cuota13 === 0) {
    next.cuota03 = repercutido
    next.base01 = deriveBaseFromCuota(repercutido)
  }

  if (soportado > 0 && next.cuota29 + next.cuota31 + next.cuota33 + next.cuota35 + next.cuota37 + next.cuota39 === 0) {
    next.cuota29 = soportado
    next.base28 = deriveBaseFromCuota(soportado)
  }

  return next
}

function finalizeTotals(values: Model303CasillaValues, resultAmount: number): Model303CasillaValues {
  const cuota27 = round2(
    values.cuota03 + values.cuota06 + values.cuota09 + values.cuota11 + values.cuota13,
  )
  const cuota45 = round2(
    values.cuota29 + values.cuota31 + values.cuota33 + values.cuota35 + values.cuota37 + values.cuota39,
  )
  const cuota46 = round2(cuota27 - cuota45)
  const cuota71 = round2(cuota46 - values.cuota110)

  return {
    ...values,
    cuota27,
    cuota45,
    cuota46,
    cuota71: resultAmount !== 0 && Math.abs(resultAmount - cuota71) > 0.01 ? resultAmount : cuota71,
  }
}

export function buildModel303CasillaValues(detail: FiscalModelDetailResponse): Model303CasillaValues {
  const hasLiquidation = detail.breakdown.some((section) => section.key === "liquidacion")

  if (hasLiquidation) {
    const values = emptyCasillas()
    return finalizeTotals(values, detail.amount)
  }

  const allLines = detail.breakdown.flatMap((section) => section.lines)
  let values = allLines.length > 0 ? analyzeEntryLines(allLines) : emptyCasillas()

  const repercutido =
    detail.breakdown.find((section) => section.key === "repercutido")?.total ??
    values.cuota03 + values.cuota06 + values.cuota09 + values.cuota11 + values.cuota13
  const soportado =
    detail.breakdown.find((section) => section.key === "soportado")?.total ??
    values.cuota29 + values.cuota31 + values.cuota33 + values.cuota35 + values.cuota37 + values.cuota39

  values = applyAggregateFallback(values, repercutido, soportado)
  return finalizeTotals(values, detail.amount)
}

function casillaRow(
  id: string,
  baseCode: string,
  cuotaCode: string | undefined,
  label: string,
  baseAmount: number | undefined,
  cuotaAmount: number,
  sectionKey: string,
  description?: string,
): DraftCasilla {
  return {
    id,
    code: baseCode,
    relatedCode: cuotaCode,
    label,
    description,
    amount: cuotaAmount,
    baseAmount,
    sectionKey,
    clickable: true,
  }
}

export function buildOfficialModel303Sections(
  detail: FiscalModelDetailResponse,
): DraftSection[] {
  const v = buildModel303CasillaValues(detail)

  return [
    {
      id: "iva-devengado",
      title: "A. IVA devengado — Cuotas repercutidas",
      casillas: [
        casillaRow("303-01", "01", "03", "Régimen general 21%", v.base01, v.cuota03, "repercutido-21"),
        casillaRow("303-04", "04", "06", "Régimen general 10%", v.base04, v.cuota06, "repercutido-10"),
        casillaRow("303-07", "07", "09", "Régimen general 4%", v.base07, v.cuota09, "repercutido-4"),
        casillaRow(
          "303-10",
          "10",
          "11",
          "Adquisiciones intracomunitarias de bienes y servicios",
          v.base10,
          v.cuota11,
          "repercutido-intra",
        ),
        casillaRow(
          "303-12",
          "12",
          "13",
          "Inversión del sujeto pasivo",
          v.base12,
          v.cuota13,
          "repercutido-isp",
        ),
        casillaRow(
          "303-27",
          "27",
          undefined,
          "Total cuota devengada",
          undefined,
          v.cuota27,
          "repercutido-total",
          "Suma de cuotas repercutidas del periodo",
        ),
      ],
    },
    {
      id: "iva-deducible",
      title: "B. IVA deducible — Cuotas soportadas",
      casillas: [
        casillaRow(
          "303-28",
          "28",
          "29",
          "Por operaciones interiores corrientes",
          v.base28,
          v.cuota29,
          "soportado-corrientes",
        ),
        casillaRow(
          "303-30",
          "30",
          "31",
          "Por operaciones interiores — bienes de inversión",
          v.base30,
          v.cuota31,
          "soportado-inversion",
        ),
        casillaRow("303-32", "32", "33", "Por importaciones — corrientes", v.base32, v.cuota33, "soportado-import-corrientes"),
        casillaRow(
          "303-34",
          "34",
          "35",
          "Por importaciones — bienes de inversión",
          v.base34,
          v.cuota35,
          "soportado-import-inversion",
        ),
        casillaRow(
          "303-36",
          "36",
          "37",
          "Por adquisiciones intracomunitarias — corrientes",
          v.base36,
          v.cuota37,
          "soportado-intra-corrientes",
        ),
        casillaRow(
          "303-38",
          "38",
          "39",
          "Por adquisiciones intracomunitarias — bienes de inversión",
          v.base38,
          v.cuota39,
          "soportado-intra-inversion",
        ),
        casillaRow(
          "303-45",
          "45",
          undefined,
          "Total a deducir",
          undefined,
          v.cuota45,
          "soportado-total",
          "Suma de cuotas soportadas deducibles",
        ),
      ],
    },
    {
      id: "resultado-liquidacion",
      title: "C. Resultado de la liquidación",
      casillas: [
        casillaRow(
          "303-46",
          "46",
          undefined,
          "Diferencia ( [27] − [45] )",
          undefined,
          v.cuota46,
          "resultado-diferencia",
        ),
        casillaRow(
          "303-110",
          "110",
          undefined,
          "Cuotas a compensar de periodos anteriores",
          undefined,
          v.cuota110,
          "resultado-compensacion",
        ),
        casillaRow(
          "303-71",
          "71",
          undefined,
          v.cuota71 >= 0 ? "Resultado: Importe a ingresar" : "Resultado: Importe a devolver / compensar",
          undefined,
          v.cuota71,
          "resultado-final",
          "Resultado final del periodo",
        ),
      ],
    },
  ]
}

export function model303CasillaEntries(values: Model303CasillaValues): Array<{ code: string; amount: number }> {
  return [
    { code: "01", amount: values.base01 },
    { code: "03", amount: values.cuota03 },
    { code: "04", amount: values.base04 },
    { code: "06", amount: values.cuota06 },
    { code: "07", amount: values.base07 },
    { code: "09", amount: values.cuota09 },
    { code: "10", amount: values.base10 },
    { code: "11", amount: values.cuota11 },
    { code: "12", amount: values.base12 },
    { code: "13", amount: values.cuota13 },
    { code: "27", amount: values.cuota27 },
    { code: "28", amount: values.base28 },
    { code: "29", amount: values.cuota29 },
    { code: "30", amount: values.base30 },
    { code: "31", amount: values.cuota31 },
    { code: "32", amount: values.base32 },
    { code: "33", amount: values.cuota33 },
    { code: "34", amount: values.base34 },
    { code: "35", amount: values.cuota35 },
    { code: "36", amount: values.base36 },
    { code: "37", amount: values.cuota37 },
    { code: "38", amount: values.base38 },
    { code: "39", amount: values.cuota39 },
    { code: "45", amount: values.cuota45 },
    { code: "46", amount: values.cuota46 },
    { code: "110", amount: values.cuota110 },
    { code: "71", amount: values.cuota71 },
  ]
}

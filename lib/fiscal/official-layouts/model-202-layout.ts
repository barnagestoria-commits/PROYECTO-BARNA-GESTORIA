import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import type { DraftCasilla, DraftSection } from "@/lib/fiscal/model-draft/types"
import { model202PeriodLabel } from "@/lib/fiscal/model-202"

/**
 * Casillas del diseño DR202e25 (ejercicio 2025 y siguientes).
 * La modalidad que no se presenta va a cero: Hacienda rechaza el fichero
 * si un artículo trae importes del otro.
 */
const LIQUIDATION_CODES = [
  "01", "02", "03",
  "04", "05", "06", "67", "37", "07", "08", "38", "39", "13", "44", "14", "45", "46",
  "16", "17", "47", "40", "48", "49", "18",
  "19", "20", "21", "22", "23", "24", "25", "61", "62", "63", "64", "65", "66", "50", "42", "51", "52", "26",
  "27", "28", "29", "30", "31", "32", "33", "34",
] as const

const PERCENT_CODES = new Set(["17", "21", "24", "29", "62", "65"])

const LABELS: Record<string, string> = {
  "01": "Base del pago fraccionado",
  "02": "Resultado de la declaración anterior",
  "03": "A ingresar",
  "04": "Resultado contable después del impuesto",
  "05": "Aumento por impuesto sobre sociedades",
  "06": "Disminución por impuesto sobre sociedades",
  "67": "Aumento por impuesto complementario",
  "37": "Disminución por el 30 % de amortización",
  "07": "Resto de aumentos",
  "08": "Resto de disminuciones",
  "38": "Total de aumentos",
  "39": "Total de disminuciones",
  "13": "Base imponible previa",
  "44": "Remanente de reserva de capitalización",
  "14": "Compensación de bases negativas",
  "45": "Reserva de nivelación. Aumentos",
  "46": "Reserva de nivelación. Disminuciones",
  "16": "Base del pago fraccionado",
  "17": "Porcentaje",
  "47": "Dotación del artículo 11.12",
  "40": "Compensación de cuotas negativas",
  "48": "Reserva de nivelación en cuota. Aumentos",
  "49": "Reserva de nivelación en cuota. Disminuciones",
  "18": "Resultado previo",
  "19": "Base del pago fraccionado, varios tipos",
  "20": "Base a tipo 1",
  "21": "Porcentaje del tipo 1",
  "22": "Importe a tipo 1",
  "23": "Base a tipo 2",
  "24": "Porcentaje del tipo 2",
  "25": "Importe a tipo 2",
  "61": "Base a tipo 3",
  "62": "Porcentaje del tipo 3",
  "63": "Importe a tipo 3",
  "64": "Base a tipo 4",
  "65": "Porcentaje del tipo 4",
  "66": "Importe a tipo 4",
  "50": "Dotación del artículo 11.12, varios tipos",
  "42": "Compensación de cuotas negativas, varios tipos",
  "51": "Reserva de nivelación. Aumentos, varios tipos",
  "52": "Reserva de nivelación. Disminuciones, varios tipos",
  "26": "Resultado previo, varios tipos",
  "27": "Bonificaciones",
  "28": "Retenciones e ingresos a cuenta",
  "29": "Volumen de operaciones en territorio común",
  "30": "Pagos fraccionados anteriores",
  "31": "Resultado de la declaración anterior",
  "32": "Resultado",
  "33": "Mínimo a ingresar",
  "34": "Cantidad a ingresar",
}

const SECTION_40_2 = ["01", "02", "03"]
const SECTION_BASE = ["04", "05", "06", "67", "37", "07", "08", "38", "39", "13", "44", "14", "45", "46"]
const SECTION_SINGLE_RATE = ["16", "17", "47", "40", "48", "49", "18"]
const SECTION_SEVERAL_RATES = ["19", "20", "21", "22", "23", "24", "25", "61", "62", "63", "64", "65", "66", "50", "42", "51", "52", "26"]
const SECTION_RESULT = ["27", "28", "29", "30", "31", "32", "33", "34"]

function sectionTotal(detail: FiscalModelDetailResponse, key: string): number {
  return detail.breakdown.find((section) => section.key === key)?.total ?? 0
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function percentLabel(value: number): string {
  const [whole, decimals] = value.toFixed(2).split(".")
  return `${whole},${decimals} %`
}

/** Importes que viajan al fichero. La modalidad inactiva queda a cero. */
export function officialModel202Amounts(detail: FiscalModelDetailResponse): Record<string, number> {
  const amounts = Object.fromEntries(LIQUIDATION_CODES.map((code) => [code, 0])) as Record<string, number>
  const modalityB = sectionTotal(detail, "modalidad") === 3

  if (!modalityB) {
    amounts["01"] = sectionTotal(detail, "c01")
    amounts["03"] = sectionTotal(detail, "c03")
    return amounts
  }

  const c05 = sectionTotal(detail, "c05")
  const c06 = sectionTotal(detail, "c06")
  const c07 = sectionTotal(detail, "c07")
  const c08 = sectionTotal(detail, "c08")
  amounts["04"] = sectionTotal(detail, "c04")
  amounts["05"] = c05
  amounts["06"] = c06
  amounts["07"] = c07
  amounts["08"] = c08
  amounts["38"] = round2(c05 + c07)
  amounts["39"] = round2(c06 + c08)
  amounts["13"] = sectionTotal(detail, "c13")
  amounts["14"] = sectionTotal(detail, "c14")
  amounts["16"] = sectionTotal(detail, "c16")
  amounts["17"] = sectionTotal(detail, "c17")
  amounts["18"] = sectionTotal(detail, "c18")
  amounts["28"] = sectionTotal(detail, "c28")
  amounts["29"] = 100
  amounts["30"] = sectionTotal(detail, "c30")
  amounts["32"] = sectionTotal(detail, "c32")
  amounts["33"] = sectionTotal(detail, "c33")
  amounts["34"] = sectionTotal(detail, "c34")
  return amounts
}

function casilla(
  code: string,
  amount: number,
  description?: string,
  label?: string,
): DraftCasilla {
  return {
    id: `202-c${code}`,
    code,
    label: label ?? LABELS[code] ?? `Casilla ${code}`,
    description,
    amount,
    amountText: PERCENT_CODES.has(code) ? percentLabel(amount) : undefined,
    clickable: false,
  }
}

function section(id: string, title: string, codes: string[], amounts: Record<string, number>, notes: Record<string, string>): DraftSection {
  return {
    id,
    title,
    casillas: codes.map((code) => casilla(code, amounts[code] ?? 0, notes[code])),
  }
}

export function buildOfficialModel202Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const quarter = detail.quarter
  if (quarter === 2) {
    return [
      {
        id: "sin-pago",
        title: "Segundo trimestre",
        casillas: [
          casilla(
            "—",
            0,
            "El modelo 202 no se presenta en julio. El siguiente pago es el 2P, en octubre.",
            "Sin pago fraccionado",
          ),
        ],
      },
    ]
  }

  const title =
    quarter === "annual"
      ? model202PeriodLabel("annual", detail.year)
      : model202PeriodLabel(quarter, detail.year)

  if (quarter === "annual") {
    return [
      {
        id: "pagos-del-ejercicio",
        title,
        casillas: [
          casilla(
            "Suma",
            detail.amount,
            "1P de abril, 2P de octubre y 3P de diciembre.",
            "Suma de los tres pagos fraccionados",
          ),
        ],
      },
    ]
  }

  const modalityB = sectionTotal(detail, "modalidad") === 3
  const amounts = officialModel202Amounts(detail)
  const missingQuota = !modalityB && sectionTotal(detail, "aviso-cuota") > 0
  const idle = modalityB
    ? "Estas casillas van a cero porque la sociedad presenta el artículo 40.3."
    : "Estas casillas van a cero porque la sociedad presenta el artículo 40.2."

  const notes: Record<string, string> = {
    "01": missingQuota
      ? "Indica en la configuración del modelo la cuota neta del último impuesto ya vencido. El pago es el 18 % de esa cuota, el mismo en abril, octubre y diciembre."
      : "Cuota neta del último ejercicio cuyo plazo de declaración ya ha vencido.",
    "02": "Solo si esta declaración es complementaria de otra del mismo periodo.",
    "03": "El 18 % de la casilla 01. No se restan los pagos fraccionados anteriores de este año.",
    "38": "Casilla 05 más casilla 67 más casilla 07.",
    "39": "Casilla 06 más casilla 37 más casilla 08.",
    "13": "Casilla 04 más casilla 38 menos casilla 39.",
    "16": "Casilla 13 menos casilla 14. No puede quedar negativa.",
    "18": "Casilla 16 por el porcentaje de la casilla 17.",
    "29": "100 % cuando la sociedad tributa solo en territorio común.",
    "32": "Casilla 18 menos retenciones y pagos anteriores, por el porcentaje de territorio común.",
    "34": "La mayor entre la casilla 32 y la casilla 33. Si sale negativa, a ingresar cero.",
  }

  return [
    section(
      "articulo-40-2",
      `${title} · artículo 40.2${modalityB ? "" : " · modalidad que se presenta"}`,
      SECTION_40_2,
      amounts,
      modalityB ? { "01": idle } : notes,
    ),
    section(
      "articulo-40-3-base",
      `Artículo 40.3 · correcciones al resultado${modalityB ? " · modalidad que se presenta" : ""}`,
      SECTION_BASE,
      amounts,
      modalityB ? notes : { "04": idle },
    ),
    section("articulo-40-3-general", "Artículo 40.3 · caso general, un solo tipo", SECTION_SINGLE_RATE, amounts, modalityB ? notes : {}),
    section("articulo-40-3-varios", "Artículo 40.3 · más de un tipo de gravamen", SECTION_SEVERAL_RATES, amounts, {}),
    section("articulo-40-3-resultado", "Artículo 40.3 · resultado", SECTION_RESULT, amounts, modalityB ? notes : {}),
  ]
}

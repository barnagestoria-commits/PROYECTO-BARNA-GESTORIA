import { parseInvoiceDetails } from "@/lib/accounting/entry-payload"
import { isThirdPartyAccountPrefix } from "@/lib/accounting/new-account-prefix"
import {
  isExpenseAccount,
  isIncomeAccount,
  isRepercutidoAccount,
  isSoportadoAccount,
  LIQUIDATION_COMMAND_CODES,
} from "@/lib/fiscal/aeat/libros-registro/codes"
import { accountCodeLookupVariants } from "@/lib/accounting/account-code-edit"
import { extractSpanishTaxId } from "@/lib/fiscal/party-identification"
import { normalizeCuenta } from "@/lib/reports/format"
import { isValidSpanishTaxId } from "@/lib/contacts/cif-lookup"
import { normalizeTaxId } from "@/lib/tax-id"
import type { FiscalModelBreakdownLine } from "@/lib/types/fiscal-panorama"

/** Umbral del art. 33 del Reglamento: operaciones superiores a 3.005,06 euros. */
export const MODEL_347_THRESHOLD = 3005.06

const PROVINCES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
  "31", "32", "33", "34", "35", "36", "37", "38", "39", "40",
  "41", "42", "43", "44", "45", "46", "47", "48", "49", "50",
  "51", "52",
])

export interface Model347SourceLine {
  cuenta: string
  concepto: string
  debe: number
  haber: number
}

export interface Model347SourceEntry {
  id: string
  fecha: string
  issueDate?: string | null
  commandCode?: string | null
  invoiceDataJson?: string | null
  lines: Model347SourceLine[]
}

export interface Model347Party {
  accountCode: string
  cif: string
  name: string
  postalCode?: string | null
}

export interface Model347Declarado {
  nif: string
  euVat: string
  nombre: string
  clave: "A" | "B"
  province: string
  country: string
  quarters: [number, number, number, number]
  annual: number
  isp: boolean
  cashBasis: boolean
  blockedReason: string | null
  entryIds: string[]
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function provinceFromPostalCode(postalCode: string | null | undefined): string {
  const digits = (postalCode ?? "").replace(/\D/g, "")
  const code = digits.slice(0, 2)
  return PROVINCES.has(code) ? code : ""
}

function quarterOf(iso: string): 1 | 2 | 3 | 4 | null {
  const month = Number(iso.slice(5, 7))
  if (!Number.isFinite(month) || month < 1 || month > 12) return null
  if (month <= 3) return 1
  if (month <= 6) return 2
  if (month <= 9) return 3
  return 4
}

function claveOf(entry: Model347SourceEntry): "A" | "B" | null {
  if (LIQUIDATION_COMMAND_CODES.has(entry.commandCode ?? "")) return null
  if (entry.commandCode === "17") return "B"
  if (entry.commandCode === "34") return "A"
  const income = entry.lines
    .filter((line) => isIncomeAccount(line.cuenta))
    .reduce((sum, line) => sum + line.haber - line.debe, 0)
  const expense = entry.lines
    .filter((line) => isExpenseAccount(line.cuenta) && !isSoportadoAccount(line.cuenta))
    .reduce((sum, line) => sum + line.debe - line.haber, 0)
  if (income <= 0 && expense <= 0 && !entry.invoiceDataJson) return null
  if (income > 0 && income >= expense) return "B"
  if (expense > 0) return "A"
  return null
}

function partyIndex(parties: Model347Party[]): Map<string, Model347Party> {
  const index = new Map<string, Model347Party>()
  for (const party of parties) {
    if (!party.accountCode) continue
    for (const variant of accountCodeLookupVariants(party.accountCode)) {
      index.set(variant, party)
      const digits = normalizeCuenta(variant)
      if (digits) index.set(digits, party)
    }
  }
  return index
}

function partyOf(
  entry: Model347SourceEntry,
  parties: Model347Party[],
  accounts: Map<string, Model347Party>,
): { nif: string; nombre: string; postalCode: string } {
  const details = parseInvoiceDetails(entry.invoiceDataJson)
  const byCif = new Map(parties.map((party) => [normalizeTaxId(party.cif), party]))
  const fromDetails = extractSpanishTaxId(details?.nif ?? "") ?? ""
  const named = details?.thirdPartyName?.trim() || ""
  if (fromDetails) {
    const party = byCif.get(fromDetails)
    return {
      nif: fromDetails,
      nombre: named || party?.name || "",
      postalCode: party?.postalCode ?? "",
    }
  }
  for (const line of entry.lines) {
    if (!isThirdPartyAccountPrefix(line.cuenta)) continue
    const party = accounts.get(line.cuenta) ?? accounts.get(normalizeCuenta(line.cuenta))
    const nif = extractSpanishTaxId(party?.cif ?? "") ?? ""
    if (nif || party?.name) {
      return { nif, nombre: party?.name || named, postalCode: party?.postalCode ?? "" }
    }
  }
  const fromText = extractSpanishTaxId(entry.lines.map((line) => line.concepto).join(" "))
  return { nif: fromText ?? "", nombre: named, postalCode: "" }
}

function is347VatLine(line: { taxForm?: string; operation: string; base: number; quota: number }): boolean {
  const form = (line.taxForm ?? "").trim()
  if (form && form !== "347") return false
  if (line.operation === "3" || line.operation === "5" || line.operation === "7") return false
  return (line.base || 0) !== 0 || (line.quota || 0) !== 0
}

function amountOf(entry: Model347SourceEntry, clave: "A" | "B"): { amount: number; isp: boolean; skipped: boolean } {
  const details = parseInvoiceDetails(entry.invoiceDataJson)
  const marked = (details?.vatLines ?? []).filter(is347VatLine)
  if ((details?.vatLines?.length ?? 0) > 0 && marked.length === 0) {
    return { amount: 0, isp: false, skipped: true }
  }
  if (marked.length > 0) {
    let amount = round2(marked.reduce((sum, line) => sum + (line.base || 0) + (line.quota || 0), 0))
    if (details?.isRectificativa && amount > 0) amount = -amount
    return { amount, isp: marked.some((line) => line.operation === "4"), skipped: false }
  }
  if (entry.commandCode !== "17" && entry.commandCode !== "34") {
    return { amount: 0, isp: false, skipped: true }
  }

  const base = round2(
    entry.lines
      .filter((line) =>
        clave === "B"
          ? isIncomeAccount(line.cuenta)
          : isExpenseAccount(line.cuenta) && !isSoportadoAccount(line.cuenta),
      )
      .reduce((sum, line) => sum + (clave === "B" ? line.haber - line.debe : line.debe - line.haber), 0),
  )
  const cuota = round2(
    entry.lines
      .filter((line) => (clave === "B" ? isRepercutidoAccount(line.cuenta) : isSoportadoAccount(line.cuenta)))
      .reduce((sum, line) => sum + (clave === "B" ? line.haber - line.debe : line.debe - line.haber), 0),
  )
  return { amount: round2(base + cuota), isp: false, skipped: false }
}

export function buildModel347Declarados(params: {
  entries: Model347SourceEntry[]
  parties: Model347Party[]
  year: number
  cashBasisSubject?: boolean
}): Model347Declarado[] {
  const grouped = new Map<string, Model347Declarado>()
  const accounts = partyIndex(params.parties)

  for (const entry of params.entries) {
    const clave = claveOf(entry)
    if (!clave) continue
    const iso = (entry.issueDate || entry.fecha).slice(0, 10)
    if (Number(iso.slice(0, 4)) !== params.year) continue
    const quarter = quarterOf(iso)
    if (!quarter) continue
    const computed = amountOf(entry, clave)
    if (computed.skipped || computed.amount === 0) continue
    const party = partyOf(entry, params.parties, accounts)
    const province = provinceFromPostalCode(party.postalCode)
    const key = `${clave}|${party.nif}|${computed.isp ? "ISP" : "GEN"}`
    const current = grouped.get(key) ?? {
      nif: party.nif,
      euVat: "",
      nombre: party.nombre,
      clave,
      province,
      country: "",
      quarters: [0, 0, 0, 0],
      annual: 0,
      isp: computed.isp,
      cashBasis: Boolean(params.cashBasisSubject),
      blockedReason: null,
      entryIds: [],
    }
    current.quarters[quarter - 1] = round2(current.quarters[quarter - 1] + computed.amount)
    current.annual = round2(current.quarters.reduce((sum, value) => sum + value, 0))
    if (!current.nombre && party.nombre) current.nombre = party.nombre
    if (!current.province && province) current.province = province
    current.entryIds.push(entry.id)
    grouped.set(key, current)
  }

  const declarados = [...grouped.values()].filter((item) => Math.abs(item.annual) > MODEL_347_THRESHOLD)
  for (const item of declarados) {
    if (!item.nif) item.blockedReason = "Falta el NIF del declarado."
    else if (!isValidSpanishTaxId(item.nif)) item.blockedReason = "El NIF del declarado no es válido."
    else if (!item.nombre.trim()) item.blockedReason = "Falta el nombre del declarado."
    else if (!item.province) item.blockedReason = "Falta el código postal del declarado para indicar la provincia."
  }
  declarados.sort((a, b) => a.clave.localeCompare(b.clave) || a.nif.localeCompare(b.nif) || a.nombre.localeCompare(b.nombre))
  return declarados
}

export function model347BreakdownLines(declarados: Model347Declarado[], year: number): FiscalModelBreakdownLine[] {
  return declarados.map((item) => ({
    entryId: item.entryIds[0] ?? `347-${item.clave}-${item.nif}`,
    entryDate: `${year}-12-31`,
    entryConcept: item.clave === "B" ? "Entregas de bienes y servicios" : "Adquisiciones de bienes y servicios",
    lineId: `347-${item.clave}-${item.nif}-${item.isp ? "isp" : "gen"}`,
    cuenta: "",
    concepto: `${item.clave} · ${item.nombre || "Sin nombre"}`,
    debe: item.clave === "A" ? Math.abs(item.annual) : 0,
    haber: item.clave === "B" ? Math.abs(item.annual) : 0,
    signedAmount: item.annual,
    category: "contributing",
    nif: item.nif,
    nombre: item.nombre,
    model347: {
      clave: item.clave,
      province: item.province,
      country: item.country,
      quarters: item.quarters,
      isp: item.isp,
      cashBasis: item.cashBasis,
      euVat: item.euVat,
      blockedReason: item.blockedReason,
    },
  }))
}

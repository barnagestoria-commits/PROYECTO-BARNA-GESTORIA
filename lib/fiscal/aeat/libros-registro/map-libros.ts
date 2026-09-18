import {
  accountDigits,
  expenseConceptFromAccount,
  incomeConceptFromAccount,
  isExpenseAccount,
  isIncomeAccount,
  isIrpfPracticedAccount,
  isIrpfSufferedAccount,
  isRepercutidoAccount,
  isSoportadoAccount,
  LIQUIDATION_COMMAND_CODES,
  resolveActivityCodes,
  round2,
  vatKeyFromOperation,
} from "@/lib/fiscal/aeat/libros-registro/codes"
import type {
  IssuedLibrosRow,
  LibrosRegistroBooks,
  LibrosRegistroContext,
  LibrosRegistroEntryInput,
  LibrosRegistroPeriod,
  ReceivedLibrosRow,
} from "@/lib/fiscal/aeat/libros-registro/types"
import { extractPrimaryEuVatId } from "@/lib/fiscal/eu-vat-id"
import {
  buildPartyAccountIndex,
  extractSpanishTaxId,
  resolvePartyIdentity,
} from "@/lib/fiscal/party-identification"
import { normalizeTaxId } from "@/lib/tax-id"
import type { InvoiceEntryDetails, InvoiceVatLine } from "@/lib/types/invoice-entry-details"

const EMPTY_IRPF = "" as const

function isoDate(value: string | Date | null | undefined, fallback = ""): string {
  if (!value) return fallback
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const raw = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    return `${slash[3]}-${slash[2]!.padStart(2, "0")}-${slash[1]!.padStart(2, "0")}`
  }
  return fallback
}

export function formatAeatDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ""
  const [year, month, day] = iso.split("-")
  return `${day}/${month}/${year}`
}

export function periodFromIsoDate(iso: string): { year: number; periodo: LibrosRegistroPeriod } {
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7))
  const periodo: LibrosRegistroPeriod = month <= 3 ? "1T" : month <= 6 ? "2T" : month <= 9 ? "3T" : "4T"
  return { year, periodo }
}

function quarterEndIso(year: number, quarter: 1 | 2 | 3 | 4): string {
  const days = { 1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31" } as const
  return `${year}-${days[quarter]}`
}

export function isWithinLibrosRange(iso: string, year: number, throughQuarter: 1 | 2 | 3 | 4): boolean {
  if (!iso) return false
  return iso >= `${year}-01-01` && iso <= quarterEndIso(year, throughQuarter)
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max)
}

function signedAmount(debe: number, haber: number, kind: "issued" | "received"): number {
  return kind === "issued" ? round2(haber - debe) : round2(debe - haber)
}

function classifyBook(entry: LibrosRegistroEntryInput): "issued" | "received" | null {
  if (LIQUIDATION_COMMAND_CODES.has(entry.commandCode ?? "")) return null
  if (entry.commandCode === "17") return "issued"
  if (entry.commandCode === "34") return "received"

  const income = entry.lines
    .filter((line) => isIncomeAccount(line.cuenta))
    .reduce((sum, line) => sum + signedAmount(line.debe, line.haber, "issued"), 0)
  const expense = entry.lines
    .filter((line) => isExpenseAccount(line.cuenta))
    .reduce((sum, line) => sum + signedAmount(line.debe, line.haber, "received"), 0)

  if (income === 0 && expense === 0 && !entry.invoiceDetails && !entry.invoiceNumber) return null
  if (income > 0 && income >= expense) return "issued"
  if (expense > 0) return "received"
  if (entry.invoiceDetails || entry.invoiceNumber) return "received"
  return null
}

function invoiceNumberParts(raw: string): { serie: string; numero: string } {
  const value = clip(raw, 40)
  if (!value) return { serie: "", numero: "" }
  const match = value.match(/^(.*?)[-/]([^/-]+)$/)
  if (match && match[1] && match[2] && match[1].length <= 20 && match[2].length <= 20) {
    return { serie: clip(match[1], 20), numero: clip(match[2], 20) }
  }
  return { serie: "", numero: clip(value, 20) }
}

function splitCounterpartyId(raw: string): { tipo: string; pais: string; identificacion: string } {
  const compact = normalizeTaxId(raw)
  if (!compact) return { tipo: "", pais: "", identificacion: "" }

  const euVat = extractPrimaryEuVatId(compact)
  if (euVat && euVat.length > 2) {
    return {
      tipo: "02",
      pais: euVat.slice(0, 2),
      identificacion: clip(euVat, 20),
    }
  }

  const spanish = extractSpanishTaxId(compact) ?? (compact.length === 9 ? compact : "")
  return { tipo: "", pais: "", identificacion: clip(spanish || compact, 20) }
}

function tipoFactura(params: {
  hasNif: boolean
  isRectificativa: boolean
  hasDocument: boolean
  book: "issued" | "received"
  operation: string
}): string {
  if (params.operation === "5" && params.book === "received") return "F5"
  if (params.isRectificativa) return params.hasNif ? "R1" : "R5"
  if (!params.hasDocument) return "SF"
  return params.hasNif ? "F1" : "F2"
}

function quotaFromBase(base: number, percent: number, stored: number): number {
  if (percent === 0) return 0
  const expected = round2(base * (percent / 100))
  if (Math.abs(expected - round2(stored)) <= 0.02) return round2(stored)
  return expected
}

function irpfFromEntry(
  entry: LibrosRegistroEntryInput,
  details: InvoiceEntryDetails | null,
  book: "issued" | "received",
): { percent: number; amount: number } {
  if (details?.applyIrpf && (details.irpfPercent || 0) > 0) {
    const bases = (details.vatLines ?? []).reduce((sum, line) => sum + (line.base || 0), 0)
    return {
      percent: details.irpfPercent,
      amount: round2(bases * (details.irpfPercent / 100)),
    }
  }

  const amount = entry.lines
    .filter((line) => (book === "issued" ? isIrpfPracticedAccount(line.cuenta) : isIrpfSufferedAccount(line.cuenta)))
    .reduce((sum, line) => sum + Math.abs(line.debe) + Math.abs(line.haber), 0)
  if (amount <= 0) return { percent: 0, amount: 0 }
  const bases = entry.lines
    .filter((line) => (book === "issued" ? isIncomeAccount(line.cuenta) : isExpenseAccount(line.cuenta)))
    .reduce((sum, line) => sum + Math.abs(signedAmount(line.debe, line.haber, book)), 0)
  const percent = bases > 0 ? round2((amount / bases) * 100) : 0
  return { percent, amount: round2(amount) }
}

function vatLinesFromEntry(
  entry: LibrosRegistroEntryInput,
  details: InvoiceEntryDetails | null,
  book: "issued" | "received",
): Array<{
  operation: string
  base: number
  percent: number
  quota: number
  conceptAccount: string
}> {
  const usableDetails = (details?.vatLines ?? []).filter((line) => (line.base || 0) !== 0 || (line.quota || 0) !== 0)
  if (usableDetails.length > 0) {
    const conceptAccount =
      entry.lines.find((line) => (book === "issued" ? isIncomeAccount(line.cuenta) : isExpenseAccount(line.cuenta)))
        ?.cuenta ?? ""
    return usableDetails.map((line: InvoiceVatLine) => ({
      operation: line.operation || "1",
      base: round2(line.base || 0),
      percent: line.vatPercent || 0,
      quota: quotaFromBase(line.base || 0, line.vatPercent || 0, line.quota || 0),
      conceptAccount,
    }))
  }

  const baseLines = entry.lines.filter((line) =>
    book === "issued" ? isIncomeAccount(line.cuenta) : isExpenseAccount(line.cuenta),
  )
  const vatAmount = entry.lines
    .filter((line) => (book === "issued" ? isRepercutidoAccount(line.cuenta) : isSoportadoAccount(line.cuenta)))
    .reduce((sum, line) => sum + signedAmount(line.debe, line.haber, book), 0)

  if (baseLines.length === 0) return []

  const bases = baseLines.map((line) => ({
    account: line.cuenta,
    base: signedAmount(line.debe, line.haber, book),
  }))
  const totalBase = bases.reduce((sum, line) => sum + line.base, 0)
  return bases
    .filter((line) => line.base !== 0)
    .map((line, index) => {
      const quota =
        index === bases.length - 1
          ? round2(vatAmount - bases.slice(0, -1).reduce((sum, item) => {
              const percent = totalBase === 0 ? 0 : round2((item.base / totalBase) * vatAmount)
              return sum + percent
            }, 0))
          : totalBase === 0
            ? 0
            : round2((line.base / totalBase) * vatAmount)
      const percent = line.base === 0 ? 0 : round2((Math.abs(quota) / Math.abs(line.base)) * 100)
      const known = [21, 10, 4, 5, 2, 0].find((rate) => Math.abs(rate - percent) < 0.3) ?? round2(percent)
      return {
        operation: "1",
        base: round2(line.base),
        percent: known,
        quota: quotaFromBase(line.base, known, quota),
        conceptAccount: line.account,
      }
    })
}

export function mapEntriesToLibrosRegistro(
  entries: LibrosRegistroEntryInput[],
  context: LibrosRegistroContext,
): LibrosRegistroBooks {
  const activity = resolveActivityCodes(context.activities)
  const directory = buildPartyAccountIndex(context.parties)
  const books: LibrosRegistroBooks = { issued: [], received: [] }

  for (const entry of entries) {
    const book = classifyBook(entry)
    if (!book) continue

    const details = entry.invoiceDetails ?? null
    const issueIso = isoDate(details?.issueDate || entry.issueDate, isoDate(entry.fecha))
    const operationIso = isoDate(details?.operationDate || entry.operationDate, issueIso)
    const receptionIso = isoDate(entry.fecha, operationIso || issueIso)
    const dateForPeriod = operationIso || issueIso || isoDate(entry.fecha)
    if (!isWithinLibrosRange(dateForPeriod, context.year, context.throughQuarter)) continue

    const { year, periodo } = periodFromIsoDate(dateForPeriod)
    const party = resolvePartyIdentity({
      cuenta: entry.lines.find((line) => /^(400|410|430|440|401|411|431)/.test(accountDigits(line.cuenta)))?.cuenta ?? "",
      concepto: entry.lines.map((line) => line.concepto).join(" "),
      siblingLines: entry.lines,
      directoryIndex: directory,
    })
    const nifRaw = details?.nif || party.nif || ""
    const name = clip(details?.thirdPartyName || party.nombre || "", 40)
    const nif = splitCounterpartyId(nifRaw)
    const document = details?.invoiceNumber || entry.invoiceNumber || ""
    const numberParts = invoiceNumberParts(document)
    const vatLines = vatLinesFromEntry(entry, details, book)
    if (vatLines.length === 0) continue

    const irpf = irpfFromEntry(entry, details, book)
    const includeIrpf = context.includeIrpf

    vatLines.forEach((vatLine, index) => {
      const vatKeys = vatKeyFromOperation(vatLine.operation, book)
      const zeroRated = vatLine.percent === 0 && vatKeys.calificacion === "S1" && !vatKeys.operacionExenta
      const calificacion = zeroRated ? "" : vatKeys.calificacion
      const exenta = zeroRated ? "E1" : vatKeys.operacionExenta
      const tipoIva = calificacion === "S2" || Boolean(exenta) ? 0 : vatLine.percent
      const cuota = tipoIva === 0 ? 0 : vatLine.quota
      const total = round2(vatLine.base + cuota)
      const firstRetention = index === 0 && irpf.amount > 0
      const invoiceType = tipoFactura({
        hasNif: Boolean(nif.identificacion),
        isRectificativa: Boolean(details?.isRectificativa),
        hasDocument: Boolean(document),
        book,
        operation: vatLine.operation,
      })

      if (book === "issued") {
        const row: IssuedLibrosRow = {
          ejercicio: year,
          periodo,
          actividadCodigo: activity.codigo,
          actividadTipo: activity.tipo,
          epigrafe: activity.epigrafe,
          tipoFactura: invoiceType,
          conceptoIngreso: includeIrpf ? incomeConceptFromAccount(vatLine.conceptAccount) : "",
          ingresoComputable: includeIrpf ? vatLine.base : EMPTY_IRPF,
          fechaExpedicion: formatAeatDate(issueIso),
          fechaOperacion: formatAeatDate(operationIso),
          serie: numberParts.serie,
          numero: numberParts.numero || numberParts.serie,
          numeroFinal: "",
          nifTipo: nif.tipo,
          nifPais: nif.pais,
          nifIdentificacion: nif.identificacion,
          nombreDestinatario: name,
          claveOperacion: vatKeys.claveOperacion,
          calificacion,
          operacionExenta: exenta,
          totalFactura: total,
          baseImponible: vatLine.base,
          tipoIva,
          cuotaIva: cuota,
          tipoRecargo: EMPTY_IRPF,
          cuotaRecargo: EMPTY_IRPF,
          tipoRetencion: includeIrpf && firstRetention ? irpf.percent : EMPTY_IRPF,
          importeRetenido: includeIrpf && firstRetention ? irpf.amount : EMPTY_IRPF,
          referenciaExterna: clip(entry.id, 40),
        }
        books.issued.push(row)
        return
      }

      const row: ReceivedLibrosRow = {
        ejercicio: year,
        periodo,
        actividadCodigo: activity.codigo,
        actividadTipo: activity.tipo,
        epigrafe: activity.epigrafe,
        tipoFactura: invoiceType,
        conceptoGasto: includeIrpf ? expenseConceptFromAccount(vatLine.conceptAccount) : "",
        gastoDeducible: includeIrpf ? vatLine.base : EMPTY_IRPF,
        fechaExpedicion: formatAeatDate(issueIso),
        fechaOperacion: formatAeatDate(operationIso),
        serieNumero: clip([numberParts.serie, numberParts.numero].filter(Boolean).join("-"), 40),
        numeroFinal: "",
        fechaRecepcion: formatAeatDate(receptionIso),
        numeroRecepcion: "",
        numeroRecepcionFinal: "",
        nifTipo: nif.tipo,
        nifPais: nif.pais,
        nifIdentificacion: nif.identificacion,
        nombreExpedidor: name,
        claveOperacion: vatKeys.claveOperacion,
        bienInversion: "N",
        inversionSujetoPasivo: vatKeys.inversionSujetoPasivo,
        deduciblePeriodoPosterior: "N",
        totalFactura: total,
        baseImponible: vatLine.base,
        tipoIva,
        cuotaIva: cuota,
        cuotaDeducible: invoiceType === "F2" ? 0 : cuota,
        tipoRecargo: EMPTY_IRPF,
        cuotaRecargo: EMPTY_IRPF,
        tipoRetencion: includeIrpf && firstRetention ? irpf.percent : EMPTY_IRPF,
        importeRetenido: includeIrpf && firstRetention ? irpf.amount : EMPTY_IRPF,
        referenciaExterna: clip(entry.id, 40),
      }
      books.received.push(row)
    })
  }

  return books
}

export function shouldOfferLibrosRegistro(modelCode: string, quarter: number | "annual"): boolean {
  if (modelCode !== "130" && modelCode !== "303") return false
  if (quarter === "annual") return modelCode === "130"
  return quarter >= 1 && quarter <= 4
}

export function librosRegistroThroughQuarter(quarter: number | "annual"): 1 | 2 | 3 | 4 {
  if (quarter === "annual" || quarter < 1 || quarter > 4) return 4
  return quarter as 1 | 2 | 3 | 4
}

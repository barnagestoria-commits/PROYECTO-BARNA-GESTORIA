import {
  buildAccountMapByCif,
  parseTcliproBuffer,
  parseTcliproSubaccounts,
} from "@/lib/imports/a3/parse-tclipro"
import { normalizeCif } from "@/lib/accounting/third-party-types"
import {
  isDirectDebitConcept,
  NATIVE_INSURANCE_ACCOUNT,
  NATIVE_PENDING_ACCOUNT,
  resolveUnidentifiedBankMovementAccount,
} from "@/lib/imports/a3/decode-native-journal-account"
import {
  extractNativeConcept,
  extractNativeDate,
  extractNativeDocument,
  extractNativePostAmountMarker,
  nativeEntryGroupKey,
  nativeEntryLookupKey,
  nativeJournalLineRecordStart,
  NATIVE_JOURNAL_CONCEPT_START,
  parseNativeJournalHeaders,
  resolveNativeAccountFromMarker,
  type NativeJournalHeaderInfo,
} from "@/lib/imports/a3/native-journal-record"
import { decodeA3Text, type ImportBytes } from "@/lib/imports/a3/import-bytes"
import {
  countFixedBlockRecords,
  countNativeCobolRecords,
  isDeletedCobolStatus,
} from "@/lib/imports/a3/native-cobol-records"
import {
  buildNativeFileIndex,
  getNativeFileByBase,
  normalizeA3BaseName,
  type IndexedNativeFile,
} from "@/lib/imports/a3/native-file-index"
import { isGenericProviderCode, isProviderAccountCode, isValidPgcAccountCode, padAccountCode12 } from "@/lib/imports/a3/native-account-code"
import {
  buildNativePlanRegistry,
  parseAacDatSubaccounts,
  parseCuDatBinarySubaccounts,
  parseDaCuDottedSubaccounts,
  parseTpPredefiDefaults,
  type NativePlanDefaults,
  type NativePlanRegistry,
} from "@/lib/imports/a3/parse-native-plan"
import {
  buildUniqueVendorAccountMap,
  ensureVendorAccount,
  lookupUniqueVendorAccount,
  subaccountsFromVendorRegistry,
} from "@/lib/imports/a3/native-vendor-accounts"
import type { A3FixedAsset, A3JournalEntry, A3JournalLine, A3Subaccount, A3ThirdParty } from "@/lib/imports/a3/types"
import {
  isAamDatBuffer,
  parseAamDatFixedAssets,
  parseTpPredefiAssetDefaults,
} from "@/lib/imports/a3/parse-a3-fixed-assets"
import {
  applyVendorMatchingToEntries,
  extractClientNameFromConcept,
  extractVendorNameFromConcept,
  normalizeVendorKey,
  resolveVendorAccountCodes,
} from "@/lib/imports/a3/vendor-matching"

const GENERIC_FALLBACK = {
  provider: "400000000000",
  client: "430000000000",
  iva: "472000000000",
  ivaRepercutido: "477000000000",
  retencion: "473000000000",
  expense: "629000000000",
  payroll: "640000000000",
  bank: "572000000000",
  bridge: NATIVE_PENDING_ACCOUNT,
  insurance: NATIVE_INSURANCE_ACCOUNT,
  payrollPayable: "465000000000",
  sales: "705000000000",
} as const

const NATIVE_HEADER = 512
const NATIVE_LINE_RECORD = 132
const NATIVE_FILE_HEADER_MAGIC = "0~"

export interface A3NativeExportManifest {
  companyFolder: string
  files: Array<{ name: string; code: string }>
}

export interface A3NativeParseResult {
  entries: A3JournalEntry[]
  subaccounts: A3Subaccount[]
  thirdParties: A3ThirdParty[]
  fixedAssets: A3FixedAsset[]
  companyCode: string | null
  fiscalYear: number | null
  recordTypes: string[]
  warnings: string[]
}

function parseAmountFromMatch(raw: string): number {
  const digits = raw.replace(/\D/g, "")
  if (!digits) return 0
  const normalized = digits.slice(-11).padStart(11, "0")
  return Number.parseInt(normalized, 10) / 100
}

function cleanConcept(raw: string): string {
  return raw
    .replace(/\x00/g, " ")
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, " ")
    .replace(/[^\x20-\x7E\u00C0-\u00FF.,\-/()&º°]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}


function conceptLinkSignature(rawConcept: string): string {
  const bytes = Buffer.from(rawConcept, "latin1")
  if (bytes.length < 4) return ""
  return bytes.subarray(bytes.length - 4).toString("hex")
}

function isPaymentConcept(concept: string): boolean {
  const upper = concept.toUpperCase()
  return (
    upper.includes("PAGO FRA") ||
    upper.includes("ADEUDO") ||
    upper.includes("TRANSFERENCIA") ||
    upper.includes("RECIBO") ||
    upper.includes("TARJETA") ||
    upper.includes("TRASPASO")
  )
}

function isPayrollConcept(concept: string): boolean {
  const upper = concept.toUpperCase()
  return (
    upper.includes("SUELDO") ||
    upper.includes("NÓMINA") ||
    upper.includes("NOMINA") ||
    upper.includes("LIQUIDO A PAGAR") ||
    upper.includes("S.S.")
  )
}

function resolveNativeLineAccount(
  seq: number,
  dh: "D" | "H",
  concept: string,
  record: ImportBytes,
  registry: NativePlanRegistry,
  vendorAccounts: Map<string, string>,
  tailVendorMap: Map<string, string>,
  vendorDisplayNames: Map<string, string>,
): string {
  const upper = concept.toUpperCase()
  const vendor = extractVendorNameFromConcept(concept)
  const client = extractClientNameFromConcept(concept)

  const vendorAccount = vendor
    ? ensureVendorAccount(vendorAccounts, vendor, "400", vendorDisplayNames)
    : null
  const clientAccount = client
    ? ensureVendorAccount(vendorAccounts, client, "430", vendorDisplayNames)
    : null

  if (seq === 1) {
    if (dh === "H") {
      if (upper.includes("RETENCION DIVID")) {
        return registry.defaultRetencionAccount ?? GENERIC_FALLBACK.retencion
      }
      return registry.defaultBankAccount ?? GENERIC_FALLBACK.bank
    }

    if (vendorAccount) return vendorAccount
    if (clientAccount) return clientAccount

    const linkedVendor = tailVendorMap.get(conceptLinkSignature(concept))
    if (linkedVendor) {
      return ensureVendorAccount(vendorAccounts, linkedVendor, "400", vendorDisplayNames)
    }

    if (upper.includes("NOMINA") || upper.includes("NÓMINA")) {
      return GENERIC_FALLBACK.payroll
    }
    if (upper.includes("GLOVO")) {
      return registry.defaultExpenseAccount ?? GENERIC_FALLBACK.expense
    }
    if (upper.includes("RECIBO") && (upper.includes("TARJETA") || upper.includes("SEGUROS") || upper.includes("AGUAS"))) {
      return registry.defaultExpenseAccount ?? GENERIC_FALLBACK.expense
    }
    if (upper.includes("LIQUIDACION") || upper.includes("BONUS")) {
      return GENERIC_FALLBACK.bridge
    }
    if (upper.includes("TRASPASO") || upper.includes("TRANSFERENCIA")) {
      return clientAccount ?? vendorAccount ?? GENERIC_FALLBACK.bridge
    }
    if (isDirectDebitConcept(concept)) {
      return resolveUnidentifiedBankMovementAccount(concept, record)
    }
    if (isPaymentConcept(concept)) {
      return resolveUnidentifiedBankMovementAccount(concept, record)
    }
    return GENERIC_FALLBACK.bridge
  }

  if (seq === 2 && dh === "H") {
    if (vendor) return ensureVendorAccount(vendorAccounts, vendor, "400", vendorDisplayNames)
    return GENERIC_FALLBACK.provider
  }

  if (seq === 2 && dh === "D") {
    return clientAccount ?? registry.defaultClientAccount ?? GENERIC_FALLBACK.client
  }

  if (seq === 3 && dh === "D") {
    return registry.defaultIvaAccount ?? GENERIC_FALLBACK.iva
  }

  if (seq === 3 && dh === "H") {
    return registry.defaultIvaRepercutidoAccount ?? GENERIC_FALLBACK.ivaRepercutido
  }

  if (seq === 5 && dh === "H") {
    return registry.defaultRetencionAccount ?? GENERIC_FALLBACK.retencion
  }

  if (seq === 6 && dh === "D") {
    if (isPayrollConcept(concept)) {
      return GENERIC_FALLBACK.payroll
    }
    return registry.defaultExpenseAccount ?? GENERIC_FALLBACK.expense
  }

  if (seq === 6 && dh === "H") {
    return registry.defaultSalesAccount ?? GENERIC_FALLBACK.sales
  }

  if (isPayrollConcept(concept)) {
    return upper.includes("LIQUIDO") || upper.includes("S.S.")
      ? GENERIC_FALLBACK.payrollPayable
      : GENERIC_FALLBACK.payroll
  }

  if (isPaymentConcept(concept)) {
    if (dh === "H") return registry.defaultBankAccount ?? GENERIC_FALLBACK.bank
    if (vendorAccount) return vendorAccount
    return resolveUnidentifiedBankMovementAccount(concept, record)
  }

  if (dh === "H") return registry.defaultBankAccount ?? GENERIC_FALLBACK.bank
  return GENERIC_FALLBACK.bridge
}

function recordHasAmountField(rec: ImportBytes): boolean {
  return /[DH]\d{11,14}/.test(decodeA3Text(rec))
}

function scanRawJournalLines(buffer: ImportBytes): Array<{ seq: number; rawConcept: string }> {
  const start = nativeJournalLineRecordStart(buffer)
  const lines: Array<{ seq: number; rawConcept: string }> = []

  for (let pos = start; pos + NATIVE_LINE_RECORD <= buffer.length; pos += NATIVE_LINE_RECORD) {
    const rec = buffer.subarray(pos, pos + NATIVE_LINE_RECORD)
    if (!isNativeJournalDataRecord(rec)) continue
    const text = decodeA3Text(rec)
    const dhMatch = text.match(/([DH])(\d{11,14})/)
    if (!dhMatch) continue

    const dhIndex = dhMatch.index ?? 0
    lines.push({
      seq: rec[11] ?? 0,
      rawConcept: text.slice(NATIVE_JOURNAL_CONCEPT_START, dhIndex),
    })
  }

  return lines
}

function buildGlobalTailVendorMap(
  files: Map<string, ImportBytes>,
  journalFiles: string[],
): Map<string, string> {
  const tailVendorMap = new Map<string, string>()

  for (const journalFile of journalFiles) {
    for (const parsed of scanRawJournalLines(files.get(journalFile)!)) {
      if (parsed.seq !== 2 && parsed.seq !== 6) continue
      const vendor = extractVendorNameFromConcept(parsed.rawConcept)
      if (!vendor) continue
      tailVendorMap.set(conceptLinkSignature(parsed.rawConcept), vendor)
    }
  }

  return tailVendorMap
}

function propagateEntryVendorAccounts(entries: A3JournalEntry[]): A3JournalEntry[] {
  return entries.map((entry) => {
    const providerAccounts = entry.lines
      .map((line) => line.cuenta.replace(/\D/g, ""))
      .filter((cuenta) => isProviderAccountCode(cuenta) && !isGenericProviderCode(cuenta))

    const clientAccounts = entry.lines
      .map((line) => line.cuenta.replace(/\D/g, ""))
      .filter((cuenta) => cuenta.startsWith("430"))

    const providerAccount = providerAccounts[0]
    const clientAccount = clientAccounts[0]

    if (!providerAccount && !clientAccount) return entry

    const lines = entry.lines.map((line) => {
      const digits = line.cuenta.replace(/\D/g, "")
      if (providerAccount && isGenericProviderCode(digits)) {
        return { ...line, cuenta: providerAccount }
      }
      if (clientAccount && digits === GENERIC_FALLBACK.client) {
        return { ...line, cuenta: clientAccount }
      }
      return line
    })

    return { ...entry, lines }
  })
}

function parseNativeJournalFile(
  buffer: ImportBytes,
  fileName: string,
  month: number,
  fiscalYear: number,
  registry: NativePlanRegistry,
  vendorAccounts: Map<string, string>,
  tailVendorMap: Map<string, string>,
  vendorDisplayNames: Map<string, string>,
  headerIndex: Map<string, NativeJournalHeaderInfo>,
): { entries: A3JournalEntry[]; warnings: string[] } {
  const warnings: string[] = []
  const start = nativeJournalLineRecordStart(buffer)
  interface ParsedNativeLine {
    entryKey: string
    lookupKey: string
    line: A3JournalLine
    seq: number
    rawConcept: string
    record: ImportBytes
  }
  const parsedLines: ParsedNativeLine[] = []

  for (let pos = start; pos + NATIVE_LINE_RECORD <= buffer.length; pos += NATIVE_LINE_RECORD) {
    const rec = buffer.subarray(pos, pos + NATIVE_LINE_RECORD)
    if (!isNativeJournalDataRecord(rec)) continue
    const text = decodeA3Text(rec)
    const dhMatch = text.match(/([DH])(\d{11,14})/)
    if (!dhMatch) continue

    const dh = dhMatch[1] as "D" | "H"
    const amount = parseAmountFromMatch(dhMatch[2])
    if (amount <= 0) continue

    const dhIndex = dhMatch.index ?? 0
    const conceptClean = extractNativeConcept(text, dhIndex)
    const lookupKey = nativeEntryLookupKey(rec)
    const header = headerIndex.get(lookupKey)
    const documento = extractNativeDocument(conceptClean, header?.documento)
    const concept = documento
      ? conceptClean.replace(new RegExp(`${documento.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "").trim()
      : conceptClean
    const seq = rec[11] ?? 0
    const entryKey = nativeEntryGroupKey(rec)
    const fecha = extractNativeDate(conceptClean, rec, fiscalYear, month, header?.fecha)

    parsedLines.push({
      entryKey,
      lookupKey,
      seq,
      rawConcept: text.slice(NATIVE_JOURNAL_CONCEPT_START, dhIndex),
      record: rec,
      line: {
        fecha,
        cuenta: "",
        concepto: concept || conceptClean,
        debe: dh === "D" ? amount : 0,
        haber: dh === "H" ? amount : 0,
        documento: documento || undefined,
      },
    })
  }

  const grouped = new Map<string, A3JournalLine[]>()
  const groupMeta = new Map<string, { concept: string; documento: string; lookupKey: string }>()

  for (const parsed of parsedLines) {
    const dh = parsed.line.debe > 0 ? "D" : "H"
    const marker = extractNativePostAmountMarker(parsed.record)
    const markerAccount = resolveNativeAccountFromMarker(marker, dh, parsed.line.concepto, registry)
    parsed.line.cuenta =
      markerAccount ??
      resolveNativeLineAccount(
        parsed.seq,
        dh,
        parsed.rawConcept,
        parsed.record,
        registry,
        vendorAccounts,
        tailVendorMap,
        vendorDisplayNames,
      )

    const existing = grouped.get(parsed.entryKey) ?? []
    existing.push(parsed.line)
    grouped.set(parsed.entryKey, existing)

    if (!groupMeta.has(parsed.entryKey)) {
      groupMeta.set(parsed.entryKey, {
        concept: parsed.line.concepto,
        documento: parsed.line.documento ?? "",
        lookupKey: parsed.lookupKey,
      })
    }
  }

  const entries: A3JournalEntry[] = []
  for (const [entryKey, lines] of grouped) {
    if (lines.length === 0) continue
    const meta = groupMeta.get(entryKey)
    const header = meta ? headerIndex.get(meta.lookupKey) : undefined
    const entryFecha = header?.fecha
      ? `${header.fecha.slice(0, 4)}-${header.fecha.slice(4, 6)}-${header.fecha.slice(6, 8)}`
      : lines[0].fecha
    const normalizedLines = lines.map((line) => ({ ...line, fecha: entryFecha }))
    entries.push({
      fecha: entryFecha,
      documento: meta?.documento ?? normalizedLines[0].documento ?? "",
      concepto: header?.concepto ?? meta?.concept ?? normalizedLines[0].concepto,
      lines: normalizedLines,
      recordTypes: ["Apunte nativo (.DAT)"],
      refNumber: header?.refNumber,
    })
  }

  if (entries.length === 0) {
    warnings.push(`No se pudieron leer asientos de ${fileName}.`)
  }

  return { entries: propagateEntryVendorAccounts(entries), warnings }
}

function entryTotals(entry: A3JournalEntry): { debe: number; haber: number } {
  return entry.lines.reduce(
    (acc, line) => ({ debe: acc.debe + line.debe, haber: acc.haber + line.haber }),
    { debe: 0, haber: 0 },
  )
}

function conceptGroupingKey(concept: string): string {
  const words = concept
    .replace(/[^\x20-\x7E\u00C0-\u00FF]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 2 && /^[A-Za-zÁÉÍÓÚÑ]+$/u.test(word))
    .slice(0, 3)
    .join(" ")
  return normalizeVendorKey(words) || words.toUpperCase()
}

/** Une apuntes partidos cuando el diario nativo genera claves distintas en D/H del mismo pago. */
function mergeComplementaryNativeEntries(entries: A3JournalEntry[]): A3JournalEntry[] {
  const used = new Set<number>()
  const merged: A3JournalEntry[] = []

  for (let i = 0; i < entries.length; i++) {
    if (used.has(i)) continue
    const left = entries[i]!
    const leftTotals = entryTotals(left)
    if (Math.abs(leftTotals.debe - leftTotals.haber) < 0.01) {
      merged.push(left)
      continue
    }

    let combined: A3JournalEntry | null = null
    for (let j = i + 1; j < entries.length; j++) {
      if (used.has(j)) continue
      const right = entries[j]!
      if (left.fecha !== right.fecha) continue

      const rightTotals = entryTotals(right)
      if (Math.abs(leftTotals.debe - rightTotals.haber) >= 0.02) continue
      if (Math.abs(leftTotals.haber - rightTotals.debe) >= 0.02) continue
      if (conceptGroupingKey(left.concepto) !== conceptGroupingKey(right.concepto)) continue

      combined = {
        fecha: left.fecha,
        documento: left.documento || right.documento,
        concepto: left.concepto.length >= right.concepto.length ? left.concepto : right.concepto,
        lines: [...left.lines, ...right.lines],
        recordTypes: left.recordTypes,
      }
      used.add(j)
      break
    }

    merged.push(combined ?? left)
  }

  return merged
}

function isNativeJournalDataRecord(rec: ImportBytes): boolean {
  return !isDeletedCobolStatus(rec[0]!)
}

function appendNativeRawCountWarnings(
  fileIndex: Map<string, IndexedNativeFile>,
  parsedCounts: Record<string, number>,
  warnings: string[],
): void {
  const tclipro = getNativeFileByBase(fileIndex, "tclipro.dat")
  if (tclipro) {
    const raw = countNativeCobolRecords(tclipro.buffer)
    const parsed = parsedCounts.TCLIPRO ?? 0
    if (parsed === 0 && raw.active > 0) {
      warnings.push(`TCLIPRO: el ZIP contiene ${raw.active} registros activos RAW pero el parser no importó ninguno.`)
    } else if (raw.active > 0) {
      warnings.push(`TCLIPRO: ${raw.active} activos / ${raw.deleted} borrados (RAW COBOL).`)
    }
  }

  const tpredefi = getNativeFileByBase(fileIndex, "tpredefi.dat")
  if (tpredefi) {
    const raw = countNativeCobolRecords(tpredefi.buffer)
    if (raw.active > 0) {
      warnings.push(`TPREDEFI: ${raw.active} activos / ${raw.deleted} borrados (RAW COBOL).`)
    }
  }

  const staivare = getNativeFileByBase(fileIndex, "staivare.dat")
  if (staivare) {
    const raw = countNativeCobolRecords(staivare.buffer)
    if (raw.active > 0) {
      warnings.push(`STAIVARE: ${raw.active} activos / ${raw.deleted} borrados (RAW COBOL).`)
    }
  }

  for (const entry of fileIndex.values()) {
    if (!normalizeA3BaseName(entry.path).endsWith("cu.dat")) continue
    const raw = countFixedBlockRecords(entry.buffer, 512, 512)
    const parsed = parsedCounts.CU ?? 0
    if (parsed === 0 && raw.active > 0) {
      warnings.push(`${normalizeA3BaseName(entry.path).toUpperCase()}: ${raw.active} registros activos RAW sin importar.`)
    }
  }
}

function validateExpManifest(
  manifest: A3NativeExportManifest | null,
  fileIndex: Map<string, IndexedNativeFile>,
  warnings: string[],
): void {
  if (!manifest) return

  for (const file of manifest.files) {
    if (!getNativeFileByBase(fileIndex, file.name)) {
      warnings.push(`El manifiesto .EXP referencia ${file.name}, pero no se encontró en el ZIP (revisar mayúsculas/ruta).`)
    }
  }
}
function parseExpManifest(content: string): A3NativeExportManifest | null {
  const lines = content.split(/\r?\n/).map((line) => line.trimEnd())
  const files: Array<{ name: string; code: string }> = []

  for (const line of lines) {
    const match = line.match(/^(\S+)\s+(\d+)\s*$/)
    if (match) {
      files.push({ name: match[1], code: match[2] })
    }
  }

  if (files.length === 0) return null
  return { companyFolder: "", files }
}

function parseTcliproFromIndex(fileIndex: Map<string, IndexedNativeFile>): {
  thirdParties: A3ThirdParty[]
  subaccounts: A3Subaccount[]
} {
  const tclipro = getNativeFileByBase(fileIndex, "tclipro.dat")
  if (!tclipro) return { thirdParties: [], subaccounts: [] }

  const subaccounts = parseTcliproSubaccounts(tclipro.buffer)
  return {
    subaccounts,
    thirdParties: parseTcliproBuffer(tclipro.buffer),
  }
}

function enrichThirdPartiesWithRegistry(
  thirdParties: A3ThirdParty[],
  vendorAccounts: Map<string, string>,
): A3ThirdParty[] {
  return thirdParties.map((party) => {
    const merged = lookupUniqueVendorAccount(vendorAccounts, party.name)
    if (merged && !isGenericProviderCode(merged)) {
      return { ...party, accountCode: merged }
    }
    if (party.accountCode && !isGenericProviderCode(party.accountCode)) return party
    return party
  })
}

function vendorAccountPriority(code: string): number {
  const digits = padAccountCode12(code).replace(/\D/g, "")
  if (isGenericProviderCode(digits)) return 0
  if (/^4100\d{4}/.test(digits) && digits !== "410000000000") return 3
  if (/^400000\d{2}/.test(digits) && digits.slice(0, 9) !== "400000000") return 2
  if (isProviderAccountCode(digits)) return 1
  return 0
}

function preferVendorAccount(existing: string, candidate: string): string {
  const existingPriority = vendorAccountPriority(existing)
  const candidatePriority = vendorAccountPriority(candidate)
  if (candidatePriority > existingPriority) return candidate
  if (candidatePriority < existingPriority) return existing

  const existingDigits = padAccountCode12(existing).replace(/\D/g, "")
  const candidateDigits = padAccountCode12(candidate).replace(/\D/g, "")
  if (/^4100/.test(existingDigits) && /^4100/.test(candidateDigits)) {
    return candidateDigits < existingDigits ? candidate : existing
  }
  if (/^400000/.test(existingDigits) && /^400000/.test(candidateDigits)) {
    return candidateDigits < existingDigits ? candidate : existing
  }
  return existing
}

function mergeSubaccountLists(...lists: A3Subaccount[][]): A3Subaccount[] {
  const byCode = new Map<string, A3Subaccount>()
  const vendorsByName = new Map<string, A3Subaccount>()
  const vendorsByNif = new Map<string, A3Subaccount>()

  const upsertVendor = (item: A3Subaccount, code: string) => {
    const nameKey = normalizeVendorKey(item.name)
    if (nameKey) {
      const existing = vendorsByName.get(nameKey)
      if (!existing) {
        vendorsByName.set(nameKey, { ...item, accountCode: code })
      } else {
        const preferred = preferVendorAccount(existing.accountCode, code)
        if (preferred !== existing.accountCode) {
          vendorsByName.set(nameKey, { ...item, accountCode: preferred })
        }
      }
    }

    if (item.nif) {
      const nif = normalizeCif(item.nif)
      if (nif) {
        const existing = vendorsByNif.get(nif)
        if (!existing) {
          vendorsByNif.set(nif, { ...item, accountCode: code })
        } else {
          const preferred = preferVendorAccount(existing.accountCode, code)
          vendorsByNif.set(nif, {
            ...existing,
            ...item,
            accountCode: preferred,
            name: existing.name.length >= item.name.length ? existing.name : item.name,
          })
        }
      }
    }
  }

  for (const list of lists) {
    for (const item of list) {
      const code = padAccountCode12(item.accountCode)
      const digits = code.replace(/\D/g, "")
      if (!isValidPgcAccountCode(digits)) continue

      const isThirdParty = isProviderAccountCode(digits) || digits.startsWith("430")

      if (isThirdParty) {
        upsertVendor(item, code)
        continue
      }

      if (!byCode.has(code)) {
        byCode.set(code, { ...item, accountCode: code })
      }
    }
  }

  const vendors = new Map<string, A3Subaccount>()
  for (const sub of [...vendorsByName.values(), ...vendorsByNif.values()]) {
    const key = sub.nif ? `nif:${normalizeCif(sub.nif)}` : `name:${normalizeVendorKey(sub.name)}`
    if (!key.endsWith(":")) vendors.set(key, sub)
  }

  return [...byCode.values(), ...vendors.values()]
}

function inferFiscalYearFromBuffers(buffers: ImportBytes[]): number {
  for (const buffer of buffers) {
    const head = decodeA3Text(buffer.slice(0, 64))
    const explicit = head.match(/(20[2-9]\d)/)
    if (explicit) return Number(explicit[1])
    if (/26[01]\d{6}/.test(head)) return 2026
  }
  return new Date().getFullYear()
}

function inferCompanyCode(manifest: A3NativeExportManifest | null, folderName: string): string | null {
  if (manifest?.companyFolder) return manifest.companyFolder.replace(/^E/i, "")
  const match = folderName.match(/E?(\d{5,7})/i)
  return match?.[1] ?? null
}

/** Prefijo de ficheros mensuales *A.DAT (p. ej. 0045826 → 004586, 0090926 → 009096). */
export function nativeJournalFilePrefix(
  companyCode: string | null,
  fileNames: string[],
): string | null {
  if (companyCode && companyCode.length >= 6) {
    const fromCode = `${companyCode.slice(0, 5)}${companyCode[5]}`
    const hasMatch = fileNames.some((name) => {
      const base = name.split("/").pop()?.toUpperCase() ?? ""
      return base.startsWith(fromCode.toUpperCase()) && /^\d{6}\d{1,2}A\.DAT$/.test(base)
    })
    if (hasMatch) return fromCode
  }

  for (const name of fileNames) {
    const base = name.split("/").pop()?.toUpperCase() ?? ""
    const match = base.match(/^(\d{6})(\d{1,2})A\.DAT$/)
    if (match) return match[1]!
  }

  if (fileNames.some((name) => /004586\d{1,2}A\.DAT/i.test(name.split("/").pop() ?? ""))) {
    return "004586"
  }

  return null
}

export function monthFromJournalFileName(fileName: string, prefix: string): number | null {
  const base = fileName.split("/").pop()?.toUpperCase() ?? ""
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = base.match(new RegExp(`^${escaped}(\\d{1,2})A\\.DAT$`, "i"))
  if (!match) return null
  const month = Number(match[1])
  return month >= 1 && month <= 12 ? month : null
}

function discoverJournalFiles(fileNames: string[], prefix: string | null): string[] {
  if (!prefix) return []
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(`^${escaped}\\d{1,2}A\\.DAT$`, "i")
  return fileNames.filter((name) => pattern.test(name.split("/").pop()?.toUpperCase() ?? ""))
}

function discoverJournalHeaderFiles(fileNames: string[], prefix: string | null): string[] {
  if (!prefix) return []
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(`^${escaped}\\d{1,2}R\\.DAT$`, "i")
  return fileNames.filter((name) => pattern.test(name.split("/").pop()?.toUpperCase() ?? ""))
}

function buildGlobalNativeHeaderIndex(
  files: Map<string, ImportBytes>,
  headerFiles: string[],
): Map<string, NativeJournalHeaderInfo> {
  const globalIndex = new Map<string, NativeJournalHeaderInfo>()
  let refOffset = 0

  for (const headerFile of headerFiles.sort()) {
    const parsed = parseNativeJournalHeaders(files.get(headerFile)!)
    for (const header of parsed) {
      const normalized = { ...header, refNumber: refOffset + header.refNumber }
      if (!globalIndex.has(normalized.lookupKey)) {
        globalIndex.set(normalized.lookupKey, normalized)
      }
    }
    refOffset += parsed.length
  }

  return globalIndex
}

function assignMissingNativeRefNumbers(entries: A3JournalEntry[]): A3JournalEntry[] {
  const used = new Set<number>()
  let maxRef = 0

  for (const entry of entries) {
    if (entry.refNumber) {
      used.add(entry.refNumber)
      maxRef = Math.max(maxRef, entry.refNumber)
    }
  }

  let nextRef = maxRef + 1
  return entries.map((entry) => {
    if (entry.refNumber) return entry
    while (used.has(nextRef)) nextRef += 1
    used.add(nextRef)
    return { ...entry, refNumber: nextRef }
  })
}

function fileBaseName(path: string): string {
  return normalizeA3BaseName(path)
}

function endsWithBase(path: string, suffix: string): boolean {
  return normalizeA3BaseName(path).endsWith(normalizeA3BaseName(suffix))
}

export { extractVendorNameFromConcept as extractVendorName }

export function isNativeA3ExportFileMap(fileNames: string[]): boolean {
  const lower = fileNames.map((name) => fileBaseName(name))
  const hasExp = lower.some((name) => /^e\d+\.exp$/i.test(name))
  const hasMonthlyJournal = lower.some((name) => /^\d{6}\d{1,2}a\.dat$/i.test(name))
  const hasCu = lower.some((name) => name.endsWith("cu.dat"))
  return hasExp || (hasMonthlyJournal && hasCu)
}

export function parseNativeA3ExportFiles(
  files: Map<string, ImportBytes>,
  folderName = "export",
): A3NativeParseResult {
  const warnings: string[] = []
  const fileIndex = buildNativeFileIndex(files)
  const fileNames = [...fileIndex.values()].map((entry) => entry.path)

  const expEntry = [...fileIndex.values()].find((entry) => /^e\d+\.exp$/i.test(normalizeA3BaseName(entry.path)))
  const manifest = expEntry ? parseExpManifest(decodeA3Text(expEntry.buffer)) : null
  validateExpManifest(manifest, fileIndex, warnings)

  const companyCode = inferCompanyCode(manifest, folderName)
  const journalPrefix = nativeJournalFilePrefix(companyCode, fileNames)
  const journalFiles = discoverJournalFiles(fileNames, journalPrefix)
  const journalHeaderFiles = discoverJournalHeaderFiles(fileNames, journalPrefix)
  const headerIndex = buildGlobalNativeHeaderIndex(files, journalHeaderFiles)

  const sampleBuffers = journalFiles
    .map((name) => files.get(name))
    .filter((buffer): buffer is ImportBytes => Boolean(buffer))
    .slice(0, 3)
  const fiscalYear = inferFiscalYearFromBuffers(
    sampleBuffers.length > 0 ? sampleBuffers : [...fileIndex.values()].map((entry) => entry.buffer),
  )

  const tcliproData = parseTcliproFromIndex(fileIndex)
  const subaccountLists: A3Subaccount[][] = []
  let tpDefaults: NativePlanDefaults = {}
  let assetDefaults = parseTpPredefiAssetDefaults(new Uint8Array(0))
  let fixedAssets: A3FixedAsset[] = []

  for (const { path, buffer } of fileIndex.values()) {
    if (endsWithBase(path, "cu.dat") || endsWithBase(path, "da.dat")) {
      subaccountLists.push(parseCuDatBinarySubaccounts(buffer), parseDaCuDottedSubaccounts(buffer))
    }
    if (endsWithBase(path, "aac.dat")) {
      subaccountLists.push(parseAacDatSubaccounts(buffer))
    }
    if (endsWithBase(path, "dc.dat")) {
      subaccountLists.push(parseDaCuDottedSubaccounts(buffer))
    }
    if (normalizeA3BaseName(path) === "tpredefi.dat") {
      tpDefaults = parseTpPredefiDefaults(buffer)
      assetDefaults = parseTpPredefiAssetDefaults(buffer)
    }
    if (normalizeA3BaseName(path) === "staivare.dat") {
      tpDefaults = { ...parseTpPredefiDefaults(buffer), ...tpDefaults }
    }
    if (endsWithBase(path, "aam.dat") && isAamDatBuffer(buffer)) {
      fixedAssets = parseAamDatFixedAssets(buffer, {
        fiscalYear,
        defaults: assetDefaults,
      })
    }
  }

  subaccountLists.push(tcliproData.subaccounts)

  const rawSubaccounts = mergeSubaccountLists(...subaccountLists)
  const vendorAccounts = buildUniqueVendorAccountMap(rawSubaccounts)
  const accountByCif = buildAccountMapByCif(rawSubaccounts)
  const vendorDisplayNames = new Map<string, string>()
  const subaccounts = subaccountsFromVendorRegistry(rawSubaccounts, vendorAccounts, vendorDisplayNames)
  const registry = buildNativePlanRegistry(subaccounts, tpDefaults)

  for (const party of tcliproData.thirdParties) {
    if (!party.cif || !party.accountCode) continue
    const normalized = party.cif.trim().toUpperCase()
    if (!accountByCif.has(normalized) && !isGenericProviderCode(party.accountCode)) {
      accountByCif.set(normalized, padAccountCode12(party.accountCode))
    }
  }

  appendNativeRawCountWarnings(fileIndex, {
    TCLIPRO: tcliproData.subaccounts.length,
    TPREDEFI: Object.keys(tpDefaults).length > 0 ? 1 : 0,
    CU: rawSubaccounts.length,
  }, warnings)

  if (subaccounts.length === 0) {
    warnings.push("No se pudieron leer subcuentas del plan nativo (CU.DAT / DA.DAT).")
  }

  if (fixedAssets.length > 0) {
    warnings.push(`Se detectaron ${fixedAssets.length} fichas de inmovilizado en AAM.DAT.`)
  }

  let thirdParties = enrichThirdPartiesWithRegistry(tcliproData.thirdParties, vendorAccounts)
  const tailVendorMap = buildGlobalTailVendorMap(files, journalFiles)
  let entries: A3JournalEntry[] = []

  for (const journalFile of journalFiles.sort()) {
    const base = journalFile.split("/").pop() ?? journalFile
    const month = monthFromJournalFileName(base, journalPrefix ?? "")
    if (!month) continue

    const parsed = parseNativeJournalFile(
      files.get(journalFile)!,
      base,
      month,
      fiscalYear,
      registry,
      vendorAccounts,
      tailVendorMap,
      vendorDisplayNames,
      headerIndex,
    )
    entries.push(...parsed.entries)
    warnings.push(...parsed.warnings)
  }

  entries = mergeComplementaryNativeEntries(entries)
  entries = assignMissingNativeRefNumbers(entries)

  if (thirdParties.length > 0 && entries.length > 0) {
    const matched = applyVendorMatchingToEntries(entries, thirdParties)
    entries = resolveVendorAccountCodes(matched.entries, accountByCif)
    if (matched.matchedVendorCifs.size === 0) {
      warnings.push(
        "Se leyeron proveedores del TCLIPRO pero no se pudieron vincular automáticamente a las líneas del diario.",
      )
    }
  }

  entries = propagateEntryVendorAccounts(entries)

  // Actualizar subcuentas con proveedores descubiertos al parsear apuntes.
  const finalSubaccounts = subaccountsFromVendorRegistry(subaccounts, vendorAccounts, vendorDisplayNames)

  if (entries.length === 0) {
    const daFile = fileNames.find((name) => (name.split("/").pop()?.toUpperCase() ?? "").endsWith("DA.DAT"))
    if (daFile) {
      warnings.push("No se encontraron ficheros mensuales *A.DAT; el diario nativo puede estar incompleto.")
    }
  }

  const genericProviderLines = entries.flatMap((e) => e.lines).filter((l) => isGenericProviderCode(l.cuenta)).length
  if (genericProviderLines > 0) {
    warnings.push(`${genericProviderLines} líneas siguen usando la cuenta genérica 400000000000.`)
  }

  const recordTypes = ["Exportación nativa ZIP (v9.50+)", "Apuntes mensuales *A.DAT"]
  if (fixedAssets.length > 0) {
    recordTypes.push(`Inmovilizado AAM.DAT (${fixedAssets.length} fichas)`)
  }

  return {
    entries,
    subaccounts: finalSubaccounts,
    thirdParties,
    fixedAssets,
    companyCode,
    fiscalYear,
    recordTypes,
    warnings,
  }
}

export function isNativeA3BinaryHeader(buffer: ImportBytes): boolean {
  return decodeA3Text(buffer.slice(0, 2)) === NATIVE_FILE_HEADER_MAGIC
}

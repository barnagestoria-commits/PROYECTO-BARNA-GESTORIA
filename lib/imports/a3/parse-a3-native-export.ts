import {
  buildAccountMapByCif,
  parseTcliproBuffer,
  parseTcliproSubaccounts,
} from "@/lib/imports/a3/parse-tclipro"
import { normalizeCif } from "@/lib/accounting/third-party-types"
import { bytesToHex, decodeLatin1, type ImportBytes } from "@/lib/imports/a3/import-bytes"
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
import type { A3JournalEntry, A3JournalLine, A3Subaccount, A3ThirdParty } from "@/lib/imports/a3/types"
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
  bridge: "555000000000",
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
    .replace(/[^\x20-\x7E\u00C0-\u00FF.,\-/()&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractDocument(concept: string): string {
  const match = concept.match(/([A-Z0-9][A-Z0-9/\-]{2,14})\s*$/)
  return match?.[1]?.trim() ?? ""
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
    if (isPaymentConcept(concept)) {
      return GENERIC_FALLBACK.provider
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
    return dh === "H" ? (registry.defaultBankAccount ?? GENERIC_FALLBACK.bank) : GENERIC_FALLBACK.provider
  }

  if (dh === "H") return registry.defaultBankAccount ?? GENERIC_FALLBACK.bank
  return GENERIC_FALLBACK.bridge
}

function recordHasAmountField(rec: ImportBytes): boolean {
  return /[DH]\d{11,14}/.test(decodeLatin1(rec))
}

function detectLineRecordStart(buffer: ImportBytes): number {
  const searchStart = NATIVE_HEADER
  const head = buffer.subarray(searchStart)
  const amountPattern = /[DH]\d{11,14}/
  const firstMatch = decodeLatin1(head).match(amountPattern)
  if (!firstMatch || firstMatch.index === undefined) {
    return searchStart
  }

  const absPos = searchStart + firstMatch.index
  let bestOffset = 0
  let bestCount = 0

  for (let trial = 0; trial < NATIVE_LINE_RECORD; trial += 1) {
    const start = absPos - trial
    if (start < NATIVE_HEADER) continue

    let count = 0
    for (let pos = start; pos + NATIVE_LINE_RECORD <= buffer.length; pos += NATIVE_LINE_RECORD) {
      if (recordHasAmountField(buffer.subarray(pos, pos + NATIVE_LINE_RECORD))) count += 1
    }

    if (count > bestCount) {
      bestCount = count
      bestOffset = trial
    }
  }

  // Desempate: la alineación correcta coloca el tipo de línea A3 en rec[11].
  for (let trial = 0; trial < NATIVE_LINE_RECORD; trial += 1) {
    const start = absPos - trial
    if (start < NATIVE_HEADER) continue

    let count = 0
    for (let pos = start; pos + NATIVE_LINE_RECORD <= buffer.length; pos += NATIVE_LINE_RECORD) {
      if (recordHasAmountField(buffer.subarray(pos, pos + NATIVE_LINE_RECORD))) count += 1
    }

    if (count !== bestCount) continue

    const rec = buffer.subarray(start, start + NATIVE_LINE_RECORD)
    const seq = rec[11] ?? 0
    if (seq >= 1 && seq <= 6) {
      return start
    }
  }

  return absPos - bestOffset
}

interface ParsedNativeLine {
  entryKey: string
  line: A3JournalLine
  seq: number
  rawConcept: string
}

function scanRawJournalLines(buffer: ImportBytes): Array<{ seq: number; rawConcept: string }> {
  const start = detectLineRecordStart(buffer)
  const lines: Array<{ seq: number; rawConcept: string }> = []

  for (let pos = start; pos + NATIVE_LINE_RECORD <= buffer.length; pos += NATIVE_LINE_RECORD) {
    const rec = buffer.subarray(pos, pos + NATIVE_LINE_RECORD)
    const text = decodeLatin1(rec)
    const dhMatch = text.match(/([DH])(\d{11,14})/)
    if (!dhMatch) continue

    const dhIndex = dhMatch.index ?? 0
    lines.push({
      seq: rec[11] ?? 0,
      rawConcept: text.slice(15, dhIndex),
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
): { entries: A3JournalEntry[]; warnings: string[] } {
  const warnings: string[] = []
  const start = detectLineRecordStart(buffer)
  const parsedLines: ParsedNativeLine[] = []

  for (let pos = start; pos + NATIVE_LINE_RECORD <= buffer.length; pos += NATIVE_LINE_RECORD) {
    const rec = buffer.subarray(pos, pos + NATIVE_LINE_RECORD)
    const text = decodeLatin1(rec)
    const dhMatch = text.match(/([DH])(\d{11,14})/)
    if (!dhMatch) continue

    const dh = dhMatch[1] as "D" | "H"
    const amount = parseAmountFromMatch(dhMatch[2])
    if (amount <= 0) continue

    const dhIndex = dhMatch.index ?? 0
    const conceptRaw = text.slice(15, dhIndex)
    const conceptClean = cleanConcept(conceptRaw)
    const documento = extractDocument(conceptClean)
    const concept = documento ? conceptClean.replace(new RegExp(`${documento}\\s*$`), "").trim() : conceptClean
    const seq = rec[11] ?? 0
    const entryKey = bytesToHex(rec.subarray(0, 10))

    const day = Math.min(Math.max(((rec[8] ?? 1) % 28) + 1, 1), 28)
    const fecha = `${fiscalYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

    parsedLines.push({
      entryKey,
      seq,
      rawConcept: conceptRaw,
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
  const groupMeta = new Map<string, { concept: string; documento: string }>()

  for (const parsed of parsedLines) {
    const dh = parsed.line.debe > 0 ? "D" : "H"
    parsed.line.cuenta = resolveNativeLineAccount(
      parsed.seq,
      dh,
      parsed.rawConcept,
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
      })
    }
  }

  const entries: A3JournalEntry[] = []
  for (const [entryKey, lines] of grouped) {
    if (lines.length === 0) continue
    const meta = groupMeta.get(entryKey)
    entries.push({
      fecha: lines[0].fecha,
      documento: meta?.documento ?? lines[0].documento ?? "",
      concepto: meta?.concept ?? lines[0].concepto,
      lines,
      recordTypes: ["Apunte nativo (.DAT)"],
    })
  }

  if (entries.length === 0) {
    warnings.push(`No se pudieron leer asientos de ${fileName}.`)
  }

  return { entries: propagateEntryVendorAccounts(entries), warnings }
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

function parseTcliproFromFiles(files: Map<string, ImportBytes>): {
  thirdParties: A3ThirdParty[]
  subaccounts: A3Subaccount[]
} {
  for (const [name, buffer] of files) {
    const base = name.split("/").pop()?.toUpperCase() ?? ""
    if (base === "TCLIPRO.DAT") {
      const subaccounts = parseTcliproSubaccounts(buffer)
      return {
        subaccounts,
        thirdParties: parseTcliproBuffer(buffer),
      }
    }
  }
  return { thirdParties: [], subaccounts: [] }
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
    const head = decodeLatin1(buffer.slice(0, 64))
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

function monthFromJournalFileName(fileName: string): number | null {
  const match = fileName.match(/004586(\d{1,2})A\.DAT/i)
  if (!match) return null
  const month = Number(match[1])
  return month >= 1 && month <= 12 ? month : null
}

function fileBaseName(path: string): string {
  return path.split("/").pop()?.toLowerCase() ?? path.toLowerCase()
}

export { extractVendorNameFromConcept as extractVendorName }

export function isNativeA3ExportFileMap(fileNames: string[]): boolean {
  const lower = fileNames.map((name) => fileBaseName(name))
  const hasExp = lower.some((name) => /^e\d+\.exp$/i.test(name))
  const hasMonthlyJournal = lower.some((name) => /004586\dA\.DAT/i.test(name))
  const hasCu = lower.some((name) => name.endsWith("cu.dat"))
  return hasExp || (hasMonthlyJournal && hasCu)
}

export function parseNativeA3ExportFiles(
  files: Map<string, ImportBytes>,
  folderName = "export",
): A3NativeParseResult {
  const warnings: string[] = []
  const fileNames = [...files.keys()]

  const expFile = fileNames.find((name) => /\/E\d+\.EXP$/i.test(name) || /^E\d+\.EXP$/i.test(name))
  const manifest = expFile ? parseExpManifest(decodeLatin1(files.get(expFile)!)) : null

  const journalFiles = fileNames.filter((name) => {
    const base = name.split("/").pop()?.toUpperCase() ?? ""
    return /^004586(\d{1,2})A\.DAT$/.test(base)
  })

  const sampleBuffers = journalFiles.slice(0, 3).map((name) => files.get(name)!)
  const fiscalYear = inferFiscalYearFromBuffers(sampleBuffers.length > 0 ? sampleBuffers : [...files.values()])
  const companyCode = inferCompanyCode(manifest, folderName)

  const tcliproData = parseTcliproFromFiles(files)
  const subaccountLists: A3Subaccount[][] = []
  let tpDefaults: NativePlanDefaults = {}

  for (const [name, buffer] of files) {
    const base = name.split("/").pop()?.toUpperCase() ?? ""
    if (base.endsWith("CU.DAT") || base.endsWith("DA.DAT")) {
      subaccountLists.push(parseCuDatBinarySubaccounts(buffer), parseDaCuDottedSubaccounts(buffer))
    }
    if (base.endsWith("AAC.DAT")) {
      subaccountLists.push(parseAacDatSubaccounts(buffer))
    }
    if (base.endsWith("DC.DAT")) {
      subaccountLists.push(parseDaCuDottedSubaccounts(buffer))
    }
    if (base === "TPREDEFI.DAT") {
      tpDefaults = parseTpPredefiDefaults(buffer)
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

  if (subaccounts.length === 0) {
    warnings.push("No se pudieron leer subcuentas del plan nativo (CU.DAT / DA.DAT).")
  }

  let thirdParties = enrichThirdPartiesWithRegistry(tcliproData.thirdParties, vendorAccounts)
  const tailVendorMap = buildGlobalTailVendorMap(files, journalFiles)
  let entries: A3JournalEntry[] = []

  for (const journalFile of journalFiles.sort()) {
    const base = journalFile.split("/").pop() ?? journalFile
    const month = monthFromJournalFileName(base)
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
    )
    entries.push(...parsed.entries)
    warnings.push(...parsed.warnings)
  }

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

  const genericLines = entries.flatMap((e) => e.lines).filter((l) => isGenericProviderCode(l.cuenta)).length
  if (genericLines > 0) {
    warnings.push(`${genericLines} líneas siguen usando cuentas genéricas tras resolver el plan nativo.`)
  }

  return {
    entries,
    subaccounts: finalSubaccounts,
    thirdParties,
    companyCode,
    fiscalYear,
    recordTypes: ["Exportación nativa ZIP (v9.50+)", "Apuntes mensuales *A.DAT"],
    warnings,
  }
}

export function isNativeA3BinaryHeader(buffer: ImportBytes): boolean {
  return decodeLatin1(buffer.slice(0, 2)) === NATIVE_FILE_HEADER_MAGIC
}

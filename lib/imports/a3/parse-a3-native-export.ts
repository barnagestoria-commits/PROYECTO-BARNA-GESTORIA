import { parseTcliproBuffer } from "@/lib/imports/a3/parse-tclipro"
import { bytesToHex, decodeLatin1, type ImportBytes } from "@/lib/imports/a3/import-bytes"
import type { A3JournalEntry, A3JournalLine, A3Subaccount, A3ThirdParty } from "@/lib/imports/a3/types"
import { applyVendorMatchingToEntries, extractVendorNameFromConcept } from "@/lib/imports/a3/vendor-matching"

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

export { extractVendorNameFromConcept as extractVendorName }

function inferAccountCode(subtype: number, dh: "D" | "H", concept: string): string {
  const upper = concept.toUpperCase()

  if (dh === "H" && (subtype === 2 || upper.includes("GASTO A") || upper.includes("SU FRA"))) {
    return "400000000000"
  }

  if (subtype === 3 || upper.includes("IVA S.") || upper.includes("IVA S/") || upper.includes("IVA R.")) {
    return "472000000000"
  }

  if (dh === "D" && (subtype === 6 || upper.startsWith("GASTO A") || upper.includes("GASTO A "))) {
    if (upper.includes("SUELDO") || upper.includes("NÓMINA") || upper.includes("NOMINA")) return "640000000000"
    return "629000000000"
  }

  if (
    upper.includes("PAGO FRA") ||
    upper.includes("ADEUDO") ||
    upper.includes("TRANSFERENCIA") ||
    upper.includes("RECIBO") ||
    upper.includes("TARJETA") ||
    upper.includes("TRASPASO")
  ) {
    return dh === "H" ? "572000000000" : "400000000000"
  }

  if (upper.includes("LIQUIDO A PAGAR") || upper.includes("S.S.")) {
    return "465000000000"
  }

  if (dh === "H") return "572000000000"
  return "555000000000"
}

function detectLineRecordStart(buffer: ImportBytes): number {
  const searchStart = NATIVE_HEADER
  const firstMatch = decodeLatin1(buffer.subarray(searchStart)).match(/[DH]\d{11,14}/)
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
      const rec = decodeLatin1(buffer.subarray(pos, pos + NATIVE_LINE_RECORD))
      if (/[DH]\d{11,14}/.test(rec)) count += 1
    }

    if (count > bestCount) {
      bestCount = count
      bestOffset = trial
    }
  }

  return absPos - bestOffset
}

function parseNativeJournalFile(
  buffer: ImportBytes,
  fileName: string,
  month: number,
  fiscalYear: number,
): { entries: A3JournalEntry[]; warnings: string[] } {
  const warnings: string[] = []
  const start = detectLineRecordStart(buffer)
  const grouped = new Map<string, A3JournalLine[]>()
  const groupMeta = new Map<string, { concept: string; documento: string }>()

  for (let pos = start; pos + NATIVE_LINE_RECORD <= buffer.length; pos += NATIVE_LINE_RECORD) {
    const rec = buffer.subarray(pos, pos + NATIVE_LINE_RECORD)
    const text = decodeLatin1(rec)
    const dhMatch = text.match(/([DH])(\d{11,14})/)
    if (!dhMatch) continue

    const dh = dhMatch[1] as "D" | "H"
    const amount = parseAmountFromMatch(dhMatch[2])
    if (amount <= 0) continue

    const dhIndex = dhMatch.index ?? 0
    const conceptRaw = cleanConcept(text.slice(15, dhIndex))
    const documento = extractDocument(conceptRaw)
    const concept = documento ? conceptRaw.replace(new RegExp(`${documento}\\s*$`), "").trim() : conceptRaw
    const subtype = rec[10] ?? 0
    const entryKey = bytesToHex(rec.subarray(0, 10))
    const cuenta = inferAccountCode(subtype, dh, conceptRaw)

    const day = Math.min(Math.max(((rec[8] ?? 1) % 28) + 1, 1), 28)
    const fecha = `${fiscalYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

    const line: A3JournalLine = {
      fecha,
      cuenta,
      concepto: concept || conceptRaw,
      debe: dh === "D" ? amount : 0,
      haber: dh === "H" ? amount : 0,
      documento: documento || undefined,
    }

    const existing = grouped.get(entryKey) ?? []
    existing.push(line)
    grouped.set(entryKey, existing)

    if (!groupMeta.has(entryKey)) {
      groupMeta.set(entryKey, { concept: line.concepto, documento: documento || "" })
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
      recordTypes: ["Apunte nativo A3"],
    })
  }

  if (entries.length === 0) {
    warnings.push(`No se pudieron leer asientos de ${fileName}.`)
  }

  return { entries, warnings }
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

function parseTcliproFromFiles(files: Map<string, ImportBytes>): A3ThirdParty[] {
  for (const [name, buffer] of files) {
    const base = name.split("/").pop()?.toUpperCase() ?? ""
    if (base === "TCLIPRO.DAT") {
      return parseTcliproBuffer(buffer)
    }
  }
  return []
}

function padAccountCode(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length >= 12) return digits.slice(0, 12)
  return digits.padEnd(12, "0")
}

function parseDaCuSubaccounts(buffer: ImportBytes): A3Subaccount[] {
  const text = decodeLatin1(buffer)
  const subaccounts: A3Subaccount[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(/(\d{3}\.\d{1,4})\s{1,3}([\x20-\x7E\u00C0-\u00FF]{4,40})/g)) {
    const accountCode = padAccountCode(match[1])
    const name = match[2].trim()
    if (!seen.has(accountCode)) {
      seen.add(accountCode)
      subaccounts.push({ accountCode, name })
    }
  }

  return subaccounts
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
  const match = fileName.match(/004586(\d)A\.DAT/i)
  if (!match) return null
  return Number(match[1])
}

function fileBaseName(path: string): string {
  return path.split("/").pop()?.toLowerCase() ?? path.toLowerCase()
}

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
    return /^004586\dA\.DAT$/.test(base)
  })

  const sampleBuffers = journalFiles.slice(0, 3).map((name) => files.get(name)!)
  const fiscalYear = inferFiscalYearFromBuffers(sampleBuffers.length > 0 ? sampleBuffers : [...files.values()])
  const companyCode = inferCompanyCode(manifest, folderName)

  const subaccounts: A3Subaccount[] = []
  const subSeen = new Set<string>()

  const mergeSubaccounts = (list: A3Subaccount[]) => {
    for (const item of list) {
      if (!subSeen.has(item.accountCode)) {
        subSeen.add(item.accountCode)
        subaccounts.push(item)
      }
    }
  }

  for (const [name, buffer] of files) {
    const base = name.split("/").pop()?.toUpperCase() ?? ""
    if (base.endsWith("CU.DAT") || base.endsWith("DA.DAT")) mergeSubaccounts(parseDaCuSubaccounts(buffer))
  }

  const thirdParties = parseTcliproFromFiles(files)
  let entries: A3JournalEntry[] = []

  for (const journalFile of journalFiles.sort()) {
    const base = journalFile.split("/").pop() ?? journalFile
    const month = monthFromJournalFileName(base)
    if (!month) continue

    const parsed = parseNativeJournalFile(files.get(journalFile)!, base, month, fiscalYear)
    entries.push(...parsed.entries)
    warnings.push(...parsed.warnings)
  }

  if (thirdParties.length > 0 && entries.length > 0) {
    const matched = applyVendorMatchingToEntries(entries, thirdParties)
    entries = matched.entries
    if (matched.matchedVendorCifs.size === 0) {
      warnings.push(
        "Se leyeron proveedores del TCLIPRO pero no se pudieron vincular automáticamente a las líneas del diario.",
      )
    }
  }

  if (entries.length === 0) {
    const daFile = fileNames.find((name) => (name.split("/").pop()?.toUpperCase() ?? "").endsWith("DA.DAT"))
    if (daFile) {
      warnings.push("No se encontraron ficheros mensuales *A.DAT; el diario nativo puede estar incompleto.")
    }
  }

  return {
    entries,
    subaccounts,
    thirdParties,
    companyCode,
    fiscalYear,
    recordTypes: ["Exportación nativa Wolters Kluwer (v9.50+)", "Apuntes mensuales *A.DAT"],
    warnings,
  }
}

export function isNativeA3BinaryHeader(buffer: ImportBytes): boolean {
  return decodeLatin1(buffer.slice(0, 2)) === NATIVE_FILE_HEADER_MAGIC
}

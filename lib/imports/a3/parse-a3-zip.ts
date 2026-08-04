import { extractZipFiles } from "@/lib/imports/a3/extract-zip-files"
import {
  isNativeA3ExportFileMap,
  parseNativeA3ExportFiles,
} from "@/lib/imports/a3/parse-a3-native-export"
import { parseDiarioTxtBuffer } from "@/lib/imports/a3/parse-diario-txt"
import { parseSubcuentTxtBuffer } from "@/lib/imports/a3/parse-subcuent-txt"
import { parseSuenlaceBuffer } from "@/lib/imports/a3/parse-suenlace-buffer"
import { decodeLatin1, type ImportBytes } from "@/lib/imports/a3/import-bytes"
import type { A3ImportPreview, A3JournalEntry, A3Subaccount, A3ThirdParty, A3ZipContents } from "@/lib/imports/a3/types"
import { normalizeCif } from "@/lib/accounting/third-party-types"

type ZipFileMap = Map<string, ImportBytes>

const SUBACCOUNT_FILE_ALIASES = ["subcuent.txt", "subcue.dat", "subcue.txt", "plan.txt"]
const JOURNAL_FILE_ALIASES = [
  "diario.txt",
  "asient.dat",
  "asiento.dat",
  "suenlace.dat",
  "suenlace.txt",
]
const VERSION_FILE_ALIASES = ["version.txt", "version.dat", "info.txt"]

function basename(path: string): string {
  return path.split("/").pop()?.toLowerCase() ?? path.toLowerCase()
}

function pickFile(files: ZipFileMap, aliases: string[]): { name: string; buffer: ImportBytes } | null {
  for (const alias of aliases) {
    const buffer = files.get(alias)
    if (buffer) return { name: alias, buffer }
  }
  return null
}

function mergeSubaccounts(...lists: A3Subaccount[][]): A3Subaccount[] {
  const map = new Map<string, A3Subaccount>()
  for (const list of lists) {
    for (const item of list) {
      if (!map.has(item.accountCode)) {
        map.set(item.accountCode, item)
      }
    }
  }
  return [...map.values()]
}

function mergeEntries(...lists: A3JournalEntry[][]): A3JournalEntry[] {
  const entries: A3JournalEntry[] = []
  const seen = new Set<string>()

  for (const list of lists) {
    for (const entry of list) {
      const key = `${entry.fecha}|${entry.documento}|${entry.lines.map((l) => `${l.cuenta}:${l.debe}:${l.haber}`).join("|")}`
      if (!seen.has(key)) {
        seen.add(key)
        entries.push(entry)
      }
    }
  }

  return entries
}

function inferFiscalYear(entries: A3JournalEntry[], fileName: string): number | null {
  if (entries.length > 0) {
    const years = entries.map((entry) => Number(entry.fecha.slice(0, 4))).filter(Number.isFinite)
    if (years.length > 0) {
      const counts = new Map<number, number>()
      for (const year of years) {
        counts.set(year, (counts.get(year) ?? 0) + 1)
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    }
  }

  const match = fileName.match(/(20\d{2})/)
  return match ? Number(match[1]) : null
}

function detectVersionLabel(files: ZipFileMap, recordTypes: string[]): string {
  for (const alias of VERSION_FILE_ALIASES) {
    const buffer = files.get(alias)
    if (!buffer) continue
    const text = decodeLatin1(buffer)
    const match = text.match(/9\.(\d{2})/)
    if (match) return `9.${match[1]}`
  }

  if (recordTypes.length > 0) return "9.50"
  return "9.50"
}

function recordTypeLabel(code: string): string {
  const labels: Record<string, string> = {
    "0": "Apuntes sin IVA",
    "1": "Facturas emitidas/recibidas",
    "2": "Rectificativas",
    "9": "Detalle IVA",
    C: "Plan de cuentas",
  }
  return labels[code] ?? `Tipo ${code}`
}

function thirdPartiesFromSuenlaceSubaccounts(subaccounts: A3Subaccount[]): A3ThirdParty[] {
  const parties: A3ThirdParty[] = []
  const seen = new Set<string>()

  for (const sub of subaccounts) {
    if (!sub.nif) continue
    const cif = normalizeCif(sub.nif)
    if (!cif || seen.has(cif)) continue
    seen.add(cif)

    const digits = sub.accountCode.replace(/\D/g, "")
    parties.push({
      cif,
      name: sub.name,
      type: digits.startsWith("430") ? "CLIENTE" : "PROVEEDOR",
      accountCode: digits.startsWith("400") || digits.startsWith("430") ? digits : undefined,
    })
  }

  return parties
}

function attachSuenlaceVendorRefs(entries: A3JournalEntry[], subaccounts: A3Subaccount[]): A3JournalEntry[] {
  const byAccount = new Map(
    subaccounts
      .filter((sub) => sub.nif)
      .map((sub) => [sub.accountCode.replace(/\D/g, ""), sub] as const),
  )

  return entries.map((entry) => ({
    ...entry,
    lines: entry.lines.map((line) => {
      const digits = line.cuenta.replace(/\D/g, "")
      const sub = byAccount.get(digits)
      if (!sub?.nif) return line
      return {
        ...line,
        vendorCif: normalizeCif(sub.nif),
        vendorName: sub.name,
      }
    }),
  }))
}

async function parseA3ZipFileMap(
  files: ZipFileMap,
  paths: string[],
  fileName: string,
): Promise<Omit<A3ImportPreview, "newSubaccountCount" | "newThirdPartyCount">> {
  const fileNames = paths.map((path) => basename(path))
  const warnings: string[] = []

  if (fileNames.length === 0) {
    throw new Error("El archivo ZIP está vacío o no contiene ficheros legibles.")
  }

  if (isNativeA3ExportFileMap(paths)) {
    const folderMatch = paths[0]?.match(/([^/]+)\//)
    const folderName = folderMatch?.[1] ?? fileName.replace(/\.zip$/i, "")
    const nativeFiles = new Map<string, ImportBytes>()
    for (const path of paths) {
      nativeFiles.set(path, files.get(basename(path))!)
    }
    const native = parseNativeA3ExportFiles(nativeFiles, folderName)
    if (native.entries.length === 0 && native.subaccounts.length === 0) {
      throw new Error("No se pudieron leer asientos del paquete ZIP nativo.")
    }

    return {
      versionLabel: "9.50",
      companyCode: native.companyCode,
      fiscalYear: native.fiscalYear,
      entryCount: native.entries.length,
      subaccountCount: native.subaccounts.length,
      thirdPartyCount: native.thirdParties.length,
      fixedAssetCount: native.fixedAssets.length,
      newFixedAssetCount: 0,
      recordTypes: native.recordTypes,
      contents: {
        fileNames,
        subaccountSource: fileNames.some((n) => n.endsWith("cu.dat")) ? "subcue.dat" : null,
        journalSource: fileNames.some((n) => /\d{6}\d{1,2}a\.dat/i.test(n)) ? "asient.dat" : "asient.dat",
        linkFormat: "native-v950",
        importMode: "native-export",
      },
      entries: native.entries,
      subaccounts: native.subaccounts,
      thirdParties: native.thirdParties,
      fixedAssets: native.fixedAssets,
      warnings: native.warnings,
    }
  }

  const subaccountFile = pickFile(files, SUBACCOUNT_FILE_ALIASES)
  const journalFile = pickFile(files, JOURNAL_FILE_ALIASES)

  const subaccountLists: A3Subaccount[][] = []
  const journalLists: A3JournalEntry[][] = []
  let companyCode: string | null = null
  const recordTypes = new Set<string>()

  let subaccountSource: A3ZipContents["subaccountSource"] = null
  let journalSource: A3ZipContents["journalSource"] = null

  if (subaccountFile) {
    if (subaccountFile.name.endsWith(".dat")) {
      const parsed = parseSuenlaceBuffer(subaccountFile.buffer)
      subaccountLists.push(parsed.subaccounts)
      companyCode = parsed.companyCode
      parsed.recordTypes.forEach((type) => recordTypes.add(type))
      subaccountSource = "subcue.dat"
    } else {
      subaccountLists.push(parseSubcuentTxtBuffer(subaccountFile.buffer))
      subaccountSource = "subcuent.txt"
    }
  }

  if (journalFile) {
    if (journalFile.name.endsWith(".dat")) {
      const parsed = parseSuenlaceBuffer(journalFile.buffer)
      journalLists.push(parsed.entries)
      companyCode = companyCode ?? parsed.companyCode
      parsed.recordTypes.forEach((type) => recordTypes.add(type))
      journalSource = journalFile.name.startsWith("suenlace") ? "suenlace" : "asient.dat"
      if (parsed.subaccounts.length > 0) {
        subaccountLists.push(parsed.subaccounts)
        if (!subaccountSource) subaccountSource = "suenlace"
      }
    } else if (journalFile.name.startsWith("suenlace")) {
      const parsed = parseSuenlaceBuffer(journalFile.buffer)
      journalLists.push(parsed.entries)
      companyCode = companyCode ?? parsed.companyCode
      parsed.recordTypes.forEach((type) => recordTypes.add(type))
      journalSource = "suenlace"
      if (parsed.subaccounts.length > 0) {
        subaccountLists.push(parsed.subaccounts)
        if (!subaccountSource) subaccountSource = "suenlace"
      }
    } else {
      journalLists.push(parseDiarioTxtBuffer(journalFile.buffer))
      journalSource = "diario.txt"
    }
  }

  if (!subaccountFile && !journalFile) {
    for (const [name, fileBuffer] of files) {
      if (name.endsWith(".dat")) {
        const parsed = parseSuenlaceBuffer(fileBuffer)
        if (parsed.entries.length > 0) {
          journalLists.push(parsed.entries)
          journalSource = "suenlace"
        }
        if (parsed.subaccounts.length > 0) {
          subaccountLists.push(parsed.subaccounts)
          subaccountSource = "suenlace"
        }
        companyCode = companyCode ?? parsed.companyCode
        parsed.recordTypes.forEach((type) => recordTypes.add(type))
      }
    }
  }

  const subaccounts = mergeSubaccounts(...subaccountLists)
  let entries = mergeEntries(...journalLists)
  const thirdParties = thirdPartiesFromSuenlaceSubaccounts(subaccounts)

  if (thirdParties.length > 0 && entries.length > 0) {
    entries = attachSuenlaceVendorRefs(entries, subaccounts)
  }

  if (entries.length === 0 && subaccounts.length === 0) {
    throw new Error(
      "No se encontraron asientos ni subcuentas. Usa un ZIP con diario (.DAT, SUENLACE.DAT o DIARIO.TXT) y plan de cuentas.",
    )
  }

  if (entries.length === 0) {
    warnings.push("Se detectaron subcuentas pero no líneas de diario importables.")
  }

  const fiscalYear = inferFiscalYear(entries, fileName)
  const sortedRecordTypes = [...recordTypes].sort()
  const versionLabel = detectVersionLabel(files, sortedRecordTypes)

  const linkFormat: A3ZipContents["linkFormat"] =
    subaccountSource?.includes("dat") || journalSource?.includes("dat") || journalSource === "suenlace"
      ? "suenlace-v950"
      : subaccountSource && journalSource
        ? "mixed"
        : "ascii-text"

  const importMode: A3ZipContents["importMode"] =
    linkFormat === "suenlace-v950" ? "suenlace-matrix" : linkFormat === "ascii-text" ? "ascii-text" : "suenlace-matrix"

  return {
    versionLabel,
    companyCode,
    fiscalYear,
    entryCount: entries.length,
    subaccountCount: subaccounts.length,
    thirdPartyCount: thirdParties.length,
    fixedAssetCount: 0,
    newFixedAssetCount: 0,
    recordTypes: sortedRecordTypes.map(recordTypeLabel),
    contents: {
      fileNames,
      subaccountSource,
      journalSource,
      linkFormat,
      importMode,
    },
    entries,
    subaccounts,
    thirdParties,
    fixedAssets: [],
    warnings,
  }
}

export async function parseA3ZipBytes(
  data: ArrayBuffer | ImportBytes,
  fileName: string,
  zipPassword?: string,
): Promise<Omit<A3ImportPreview, "newSubaccountCount" | "newThirdPartyCount">> {
  const { byBase, paths } = await extractZipFiles(data, zipPassword)
  return parseA3ZipFileMap(byBase, paths, fileName)
}

export async function parseA3ZipBuffer(
  buffer: Buffer,
  fileName: string,
  zipPassword?: string,
): Promise<Omit<A3ImportPreview, "newSubaccountCount" | "newThirdPartyCount">> {
  return parseA3ZipBytes(buffer, fileName, zipPassword)
}

export { recordTypeLabel }

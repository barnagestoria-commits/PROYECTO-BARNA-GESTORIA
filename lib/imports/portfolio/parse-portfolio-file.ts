import JSZip from "jszip"
import * as XLSX from "xlsx"
import { normalizeCif } from "@/lib/accounting/third-party-types"
import { parseDaCuSubaccounts } from "@/lib/imports/portfolio/extract-a3-folder-identity"
import type { PortfolioCompanyCandidate, PortfolioImportPreview } from "@/lib/imports/portfolio/types"

const NIF_PATTERN =
  /([A-HJ-NP-SUVW]\d{7}[0-9A-J]|\d{8}[A-Z]|[A-Z]{2}\d{2,12}|\d{8,12}[A-Z0-9])/gi

const COMPANY_FOLDER_PATTERN = /^E?\d{4,7}$/i

const CSV_NAME_HEADERS = ["nombre", "razon social", "razón social", "name", "empresa", "cliente"]
const CSV_CIF_HEADERS = ["nif", "cif", "n.i.f.", "dni"]
const CSV_CODE_HEADERS = ["codigo", "código", "code", "cliente", "codigo cliente", "código cliente"]

function basename(path: string): string {
  return path.split("/").pop()?.toLowerCase() ?? path.toLowerCase()
}

function inferEntityType(cif: string | null): "juridica" | "fisica" {
  if (!cif) return "juridica"
  const first = cif[0]?.toUpperCase()
  if (first && "XYZ".includes(first)) return "fisica"
  if (/^\d/.test(cif)) return "fisica"
  return "juridica"
}

function cleanCompanyName(raw: string): string {
  return raw
    .replace(/\x00/g, " ")
    .replace(/[\x01-\x08\x0E-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
}

function extractIdentityFromFolder(
  folderName: string,
  files: Map<string, Buffer>,
): PortfolioCompanyCandidate {
  const codeMatch = folderName.match(/E?(\d{4,7})/i)
  const clientCode = codeMatch?.[1] ?? folderName.replace(/^E/i, "")

  let name: string | null = null
  let cif: string | null = null

  const allText = [...files.values()].map((buffer) => buffer.toString("latin1")).join("\n")

  const companyNameMatch = allText.match(
    /([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\s.\-&]{4,55}(?:S\.?\s*L\.?\.?U\.?|S\.?\s*A\.?|S\.L\.|S\.A\.))/i,
  )
  if (companyNameMatch) {
    name = cleanCompanyName(companyNameMatch[1])
  }

  for (const buffer of files.values()) {
    const subs = parseDaCuSubaccounts(buffer)
    const capital = subs.find((sub) => sub.accountCode.startsWith("100"))
    if (capital && capital.name.length > 4) {
      name = name ?? cleanCompanyName(capital.name)
    }
  }

  for (const match of allText.matchAll(NIF_PATTERN)) {
    const normalized = normalizeCif(match[1].trim())
    if (!normalized || normalized.length < 8) continue
    if (/^[ABCDEFGHJNPQRSUVW]/i.test(normalized)) {
      cif = normalized
      break
    }
  }

  if (!cif) {
    for (const match of allText.matchAll(NIF_PATTERN)) {
      const normalized = normalizeCif(match[1].trim())
      if (normalized && normalized.length >= 8) {
        cif = normalized
        break
      }
    }
  }

  return {
    clientCode: clientCode.padStart(5, "0").slice(-7),
    name: name ?? `Empresa E${clientCode}`,
    cif,
    entityType: inferEntityType(cif),
    source: "a3-folder",
    folderPath: folderName,
  }
}

async function parseMultiFolderZip(buffer: Buffer): Promise<PortfolioCompanyCandidate[]> {
  const zip = await JSZip.loadAsync(buffer)
  const folderFiles = new Map<string, Map<string, Buffer>>()

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const parts = path.split("/").filter(Boolean)
    const topFolder = parts.length > 1 ? parts[0] : ""
    const key = topFolder || "_root_"
    const fileMap = folderFiles.get(key) ?? new Map<string, Buffer>()
    fileMap.set(basename(path), await entry.async("nodebuffer"))
    folderFiles.set(key, fileMap)
  }

  const candidates: PortfolioCompanyCandidate[] = []

  for (const [folder, files] of folderFiles) {
    if (folder === "_root_") {
      const hasNativeExport = [...files.keys()].some(
        (name) =>
          /^e\d+\.exp$/i.test(name) ||
          /004586\dA\.dat/i.test(name) ||
          name.endsWith("cu.dat"),
      )
      if (hasNativeExport) {
        candidates.push(extractIdentityFromFolder("E00000", files))
      }
      continue
    }

    if (!COMPANY_FOLDER_PATTERN.test(folder)) continue
    if (files.size === 0) continue

    candidates.push(extractIdentityFromFolder(folder, files))
  }

  return dedupeCandidates(candidates)
}

function dedupeCandidates(candidates: PortfolioCompanyCandidate[]): PortfolioCompanyCandidate[] {
  const seen = new Set<string>()
  const result: PortfolioCompanyCandidate[] = []

  for (const candidate of candidates) {
    const key = candidate.cif ?? `${candidate.clientCode}|${candidate.name.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(candidate)
  }

  return result
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.some((alias) => header.includes(alias)))
}

function parseCsvPortfolio(buffer: Buffer): PortfolioCompanyCandidate[] {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "")
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []

  const delimiter = lines[0].includes(";") ? ";" : ","
  const headers = lines[0].split(delimiter).map(normalizeHeader)
  const nameIdx = findColumnIndex(headers, CSV_NAME_HEADERS)
  const cifIdx = findColumnIndex(headers, CSV_CIF_HEADERS)
  const codeIdx = findColumnIndex(headers, CSV_CODE_HEADERS)

  if (nameIdx < 0) {
    throw new Error("El CSV debe incluir una columna de nombre (nombre, razón social, empresa…).")
  }

  const candidates: PortfolioCompanyCandidate[] = []

  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""))
    const name = cleanCompanyName(cells[nameIdx] ?? "")
    if (!name) continue

    const rawCif = cifIdx >= 0 ? cells[cifIdx] : ""
    const cif = rawCif ? normalizeCif(rawCif) : null
    const rawCode = codeIdx >= 0 ? cells[codeIdx] : String(1564 + candidates.length)
    const clientCode = rawCode.replace(/\D/g, "").padStart(5, "0").slice(-7) || String(1564 + candidates.length)

    candidates.push({
      clientCode,
      name,
      cif,
      entityType: inferEntityType(cif),
      source: "csv",
    })
  }

  return dedupeCandidates(candidates)
}

function parseXlsxPortfolio(buffer: Buffer): PortfolioCompanyCandidate[] {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
  if (rows.length === 0) return []

  const headers = Object.keys(rows[0]).map(normalizeHeader)
  const nameKey = Object.keys(rows[0]).find((_, idx) =>
    CSV_NAME_HEADERS.some((alias) => headers[idx]?.includes(alias)),
  )
  const cifKey = Object.keys(rows[0]).find((_, idx) =>
    CSV_CIF_HEADERS.some((alias) => headers[idx]?.includes(alias)),
  )
  const codeKey = Object.keys(rows[0]).find((_, idx) =>
    CSV_CODE_HEADERS.some((alias) => headers[idx]?.includes(alias)),
  )

  if (!nameKey) {
    throw new Error("El Excel debe incluir una columna de nombre (nombre, razón social, empresa…).")
  }

  const candidates: PortfolioCompanyCandidate[] = []

  for (const row of rows) {
    const name = cleanCompanyName(String(row[nameKey] ?? ""))
    if (!name) continue

    const rawCif = cifKey ? String(row[cifKey] ?? "") : ""
    const cif = rawCif ? normalizeCif(rawCif) : null
    const rawCode = codeKey ? String(row[codeKey] ?? "") : String(1564 + candidates.length)
    const clientCode = rawCode.replace(/\D/g, "").padStart(5, "0").slice(-7) || String(1564 + candidates.length)

    candidates.push({
      clientCode,
      name,
      cif,
      entityType: inferEntityType(cif),
      source: "xlsx",
    })
  }

  return dedupeCandidates(candidates)
}

function isTcliproOnlyZip(fileNames: string[]): boolean {
  const lower = fileNames.map((name) => basename(name))
  return lower.length > 0 && lower.every((name) => name === "tclipro.dat")
}

export async function parsePortfolioFile(
  buffer: Buffer,
  fileName: string,
): Promise<{ candidates: PortfolioCompanyCandidate[]; sourceType: PortfolioImportPreview["sourceType"]; warnings: string[] }> {
  const extension = fileName.toLowerCase().split(".").pop() ?? ""
  const warnings: string[] = []

  if (extension === "csv" || extension === "txt") {
    const candidates = parseCsvPortfolio(buffer)
    if (candidates.length === 0) {
      throw new Error("No se encontraron empresas en el fichero CSV.")
    }
    return { candidates, sourceType: "csv", warnings }
  }

  if (extension === "xlsx" || extension === "xls") {
    const candidates = parseXlsxPortfolio(buffer)
    if (candidates.length === 0) {
      throw new Error("No se encontraron empresas en el Excel.")
    }
    return { candidates, sourceType: "xlsx", warnings }
  }

  if (extension === "zip") {
    const zip = await JSZip.loadAsync(buffer)
    const paths = Object.keys(zip.files).filter((path) => !zip.files[path].dir)
    const fileNames = paths.map(basename)

    if (isTcliproOnlyZip(fileNames)) {
      throw new Error(
        "TCLIPRO.DAT contiene proveedores/clientes contables, no empresas de la cartera. Usa un ZIP con carpetas E00xxx (exportación A3) o un CSV con nombre y NIF.",
      )
    }

    const candidates = await parseMultiFolderZip(buffer)
    if (candidates.length === 0) {
      throw new Error(
        "No se detectaron empresas en el ZIP. Usa carpetas E00xxx de exportación Wolters Kluwer o un CSV/Excel con columnas nombre y NIF.",
      )
    }

    if (candidates.some((item) => !item.cif)) {
      warnings.push(
        "Algunas empresas no tienen NIF detectado automáticamente. Podrás completarlo después en la ficha del cliente.",
      )
    }

    return { candidates, sourceType: "multi-zip", warnings }
  }

  if (extension === "dat" && basename(fileName) === "tclipro.dat") {
    throw new Error(
      "TCLIPRO.DAT no es un fichero de cartera de empresas. Sube un ZIP multi-empresa o un CSV/Excel.",
    )
  }

  throw new Error("Formato no soportado. Usa ZIP (carpetas E00xxx), CSV o Excel (.xlsx).")
}

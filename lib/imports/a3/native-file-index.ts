import type { ImportBytes } from "@/lib/imports/a3/import-bytes"

/** Normaliza nombres de fichero A3 sin distinguir mayúsculas (Linux/Vercel). */
export function normalizeA3BaseName(path: string): string {
  const base = (path.split("/").pop() ?? path).normalize("NFKC")
  return base.toLowerCase()
}

export function isMacOsMetadataPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/")
  const base = normalized.split("/").pop() ?? normalized
  return normalized.includes("__MACOSX/") || base.startsWith("._")
}

export interface IndexedNativeFile {
  path: string
  buffer: ImportBytes
}

export function buildNativeFileIndex(files: Map<string, ImportBytes>): Map<string, IndexedNativeFile> {
  const index = new Map<string, IndexedNativeFile>()
  for (const [path, buffer] of files) {
    if (isMacOsMetadataPath(path)) continue
    const key = normalizeA3BaseName(path)
    if (!key) continue
    index.set(key, { path, buffer })
  }
  return index
}

export function getNativeFileByBase(
  index: Map<string, IndexedNativeFile>,
  baseName: string,
): IndexedNativeFile | null {
  return index.get(normalizeA3BaseName(baseName)) ?? null
}

export function listNativeFileBases(index: Map<string, IndexedNativeFile>): string[] {
  return [...index.values()].map((entry) => normalizeA3BaseName(entry.path))
}

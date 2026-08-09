import JSZip from "jszip"
import { BlobReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js"
import { toUint8Array, type ImportBytes } from "@/lib/imports/a3/import-bytes"
import { isMacOsMetadataPath, normalizeA3BaseName } from "@/lib/imports/a3/native-file-index"
import {
  isJsZipEncryptedLoadError,
  isZipJsEncryptedEntryError,
  isZipJsInvalidPasswordError,
  ZipPasswordIncorrectError,
  ZipPasswordRequiredError,
} from "@/lib/imports/a3/zip-password-errors"

export type ZipFileMap = Map<string, ImportBytes>

function basename(path: string): string {
  return normalizeA3BaseName(path)
}

function shouldSkipZipEntry(path: string): boolean {
  return isMacOsMetadataPath(path)
}

async function extractWithJsZip(bytes: ImportBytes): Promise<{ byBase: ZipFileMap; paths: string[] }> {
  const zip = await JSZip.loadAsync(bytes)
  const byBase = new Map<string, ImportBytes>()
  const paths: string[] = []

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || shouldSkipZipEntry(path)) continue
    paths.push(path)
    const content = await entry.async("uint8array")
    byBase.set(basename(path), content)
  }

  return { byBase, paths }
}

async function extractWithZipJs(
  bytes: ImportBytes,
  password?: string,
): Promise<{ byBase: ZipFileMap; paths: string[] }> {
  const blob = new Blob([Uint8Array.from(bytes)])
  const reader = new ZipReader(new BlobReader(blob))
  const byBase = new Map<string, ImportBytes>()
  const paths: string[] = []
  let encryptedWithoutPassword = false

  try {
    const entries = await reader.getEntries()

    for (const entry of entries) {
      if (entry.directory || shouldSkipZipEntry(entry.filename)) continue
      paths.push(entry.filename)

      try {
        const content = await entry.getData(
          new Uint8ArrayWriter(),
          password ? { password } : undefined,
        )
        byBase.set(basename(entry.filename), content)
      } catch (error) {
        if (!password && isZipJsEncryptedEntryError(error)) {
          encryptedWithoutPassword = true
          continue
        }
        if (password && isZipJsInvalidPasswordError(error)) {
          throw new ZipPasswordIncorrectError()
        }
        throw error
      }
    }
  } finally {
    await reader.close()
  }

  if (encryptedWithoutPassword || (password && byBase.size === 0 && paths.length > 0)) {
    if (password) {
      throw new ZipPasswordIncorrectError()
    }
    throw new ZipPasswordRequiredError()
  }

  return { byBase, paths }
}

/** Extrae ficheros de un ZIP A3, con soporte opcional de contraseña (export protegido). */
export async function extractZipFiles(
  data: ArrayBuffer | ImportBytes,
  password?: string,
): Promise<{ byBase: ZipFileMap; paths: string[] }> {
  const bytes = toUint8Array(data)

  if (password) {
    return extractWithZipJs(bytes, password)
  }

  try {
    return await extractWithJsZip(bytes)
  } catch (error) {
    if (isJsZipEncryptedLoadError(error)) {
      throw new ZipPasswordRequiredError()
    }
    throw error
  }
}

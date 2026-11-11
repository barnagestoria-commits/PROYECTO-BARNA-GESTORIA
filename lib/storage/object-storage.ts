import { createHash, randomUUID } from "crypto"
import { mkdir, readFile, rm, writeFile } from "fs/promises"
import path from "path"

export type StoredObjectKind = "documents" | "bank-statements" | "certificates" | "imports"

export interface StoredObjectRef {
  storageKey: string
  url: string | null
  sha256: string
  byteSize: number
  contentType: string
}

const LOCAL_ROOT = path.join(process.cwd(), ".data", "object-storage")

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined
}

function blobStoreEnabled(): boolean {
  return Boolean(blobToken() || process.env.VERCEL === "1")
}

export function sanitizeStorageFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim() || "archivo"
  return base.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "archivo"
}

export function buildCompanyStorageKey(
  companyId: string,
  kind: StoredObjectKind,
  fileName: string,
): string {
  const year = new Date().getUTCFullYear()
  const id = randomUUID()
  return `taxlyn/${companyId}/${kind}/${year}/${id}-${sanitizeStorageFileName(fileName)}`
}

export function assertCompanyStorageKey(
  companyId: string,
  storageKey: string,
  kind?: StoredObjectKind,
): void {
  const prefix = kind ? `taxlyn/${companyId}/${kind}/` : `taxlyn/${companyId}/`
  if (
    !companyId ||
    !storageKey.startsWith(prefix) ||
    storageKey.includes("..") ||
    storageKey.includes("\\") ||
    storageKey.startsWith("/")
  ) {
    throw new Error("La referencia de archivo no pertenece a esta empresa.")
  }
}

export function hashBufferSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}

function localPathForKey(storageKey: string): string {
  if (storageKey.includes("..") || storageKey.startsWith("/") || storageKey.includes("\\")) {
    throw new Error("Clave de almacenamiento no válida.")
  }
  return path.join(LOCAL_ROOT, storageKey)
}

async function putLocal(storageKey: string, body: Buffer): Promise<string | null> {
  const fullPath = localPathForKey(storageKey)
  await mkdir(path.dirname(fullPath), { recursive: true })
  await writeFile(fullPath, body)
  return null
}

async function getLocal(storageKey: string): Promise<Buffer> {
  return readFile(localPathForKey(storageKey))
}

async function deleteLocal(storageKey: string): Promise<void> {
  await rm(localPathForKey(storageKey), { force: true })
}

function blobAuth() {
  const token = blobToken()
  return token ? { token } : {}
}

async function putBlob(storageKey: string, body: Buffer, contentType: string): Promise<string> {
  const { put } = await import("@vercel/blob")
  const result = await put(storageKey, body, {
    access: "private",
    contentType,
    addRandomSuffix: false,
    multipart: body.length > 4 * 1024 * 1024,
    ...blobAuth(),
  })
  return result.url
}

async function getBlob(storageKey: string): Promise<Buffer> {
  const { get } = await import("@vercel/blob")
  const result = await get(storageKey, {
    access: "private",
    useCache: false,
    ...blobAuth(),
  })
  if (!result?.stream) {
    throw new Error("No se encontró el archivo en el almacén de objetos.")
  }
  return Buffer.from(await new Response(result.stream).arrayBuffer())
}

async function deleteBlob(storageKey: string): Promise<void> {
  const { del } = await import("@vercel/blob")
  await del(storageKey, blobAuth())
}

export async function putCompanyObject(params: {
  companyId: string
  kind: StoredObjectKind
  fileName: string
  body: Buffer
  contentType: string
}): Promise<StoredObjectRef> {
  if (!params.body.length) {
    throw new Error("El archivo está vacío.")
  }

  const storageKey = buildCompanyStorageKey(params.companyId, params.kind, params.fileName)
  const sha256 = hashBufferSha256(params.body)

  if (blobStoreEnabled()) {
    const url = await putBlob(storageKey, params.body, params.contentType)
    return {
      storageKey,
      url,
      sha256,
      byteSize: params.body.length,
      contentType: params.contentType,
    }
  }

  const url = await putLocal(storageKey, params.body)
  return {
    storageKey,
    url,
    sha256,
    byteSize: params.body.length,
    contentType: params.contentType,
  }
}

export async function getStoredObject(storageKey: string): Promise<Buffer> {
  if (blobStoreEnabled()) {
    try {
      return await getBlob(storageKey)
    } catch {
      if (process.env.VERCEL === "1") throw new Error("No se encontró el archivo en el almacén de objetos.")
    }
  }
  return getLocal(storageKey)
}

export async function deleteStoredObject(storageKey: string | null | undefined): Promise<void> {
  if (!storageKey) return
  if (blobStoreEnabled()) {
    try {
      await deleteBlob(storageKey)
      return
    } catch {
      if (process.env.VERCEL === "1") return
    }
  }
  await deleteLocal(storageKey)
}

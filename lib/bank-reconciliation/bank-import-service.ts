import type { BankStatementSource } from "@prisma/client"
import { buildBankMovementDedupeKey } from "@/lib/bank-reconciliation/dedupe"
import { extractBankStatementPreview } from "@/lib/bank-reconciliation/extract-bank-statement-ocr"
import { parseBankSpreadsheetBuffer } from "@/lib/bank-reconciliation/parse-bank-spreadsheet"
import type { BankImportPreview, BankMovementDraft } from "@/lib/bank-reconciliation/types"
import { prisma } from "@/lib/db"
import { chunkArray, DB_INSERT_CHUNK_SIZE } from "@/lib/storage/batch"
import {
  assertCompanyStorageKey,
  deleteStoredObject,
  getStoredObject,
  hashBufferSha256,
  putCompanyObject,
  type StoredObjectRef,
} from "@/lib/storage/object-storage"
import {
  assertUploadSize,
  BANK_PREVIEW_SAMPLE_SIZE,
  DEDUPE_LOOKUP_CHUNK_SIZE,
  UPLOAD_LIMITS_BYTES,
} from "@/lib/storage/upload-limits"

function sourceFromPreview(source: BankImportPreview["source"]): BankStatementSource {
  return source
}

export function prepareBankMovementsForInsert(
  movements: BankMovementDraft[],
  existingKeys: Set<string>,
): { toInsert: Array<BankMovementDraft & { dedupeKey: string }>; duplicatesSkipped: number } {
  const toInsert: Array<BankMovementDraft & { dedupeKey: string }> = []
  let duplicatesSkipped = 0

  for (const movement of movements) {
    const dedupeKey = buildBankMovementDedupeKey(movement)
    if (existingKeys.has(dedupeKey)) {
      duplicatesSkipped += 1
      continue
    }
    existingKeys.add(dedupeKey)
    toInsert.push({ ...movement, dedupeKey })
  }

  return { toInsert, duplicatesSkipped }
}

export async function loadExistingDedupeKeys(companyId: string, keys: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  for (const part of chunkArray(keys, DEDUPE_LOOKUP_CHUNK_SIZE)) {
    if (part.length === 0) continue
    const rows = await prisma.bankMovement.findMany({
      where: { companyId, dedupeKey: { in: part } },
      select: { dedupeKey: true },
    })
    for (const row of rows) found.add(row.dedupeKey)
  }
  return found
}

export async function previewBankStatementImport(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<BankImportPreview> {
  const lower = fileName.toLowerCase()

  if (lower.endsWith(".csv") || lower.endsWith(".txt") || lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseBankSpreadsheetBuffer(buffer, fileName)
  }

  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    return extractBankStatementPreview(buffer, fileName, mimeType)
  }

  throw new Error("Formato no soportado. Usa CSV, Excel (.xlsx) o PDF de extracto bancario.")
}

export async function stageBankStatementImport(params: {
  companyId: string
  fileName: string
  mimeType: string
  buffer: Buffer
}): Promise<{ stored: StoredObjectRef; preview: BankImportPreview }> {
  assertUploadSize(params.buffer.length, UPLOAD_LIMITS_BYTES.bankStatement, "El extracto bancario")

  const stored = await putCompanyObject({
    companyId: params.companyId,
    kind: "bank-statements",
    fileName: params.fileName,
    body: params.buffer,
    contentType: params.mimeType || "application/octet-stream",
  })

  try {
    const preview = await previewBankStatementImport(params.buffer, params.fileName, params.mimeType)
    return { stored, preview }
  } catch (error) {
    await deleteStoredObject(stored.storageKey)
    throw error
  }
}

export function toBankPreviewClientPayload(stored: StoredObjectRef, preview: BankImportPreview) {
  return {
    storageKey: stored.storageKey,
    fileName: preview.fileName,
    source: preview.source,
    movementCount: preview.movements.length,
    warnings: preview.warnings,
    sample: preview.movements.slice(0, BANK_PREVIEW_SAMPLE_SIZE),
  }
}

export async function confirmBankStatementImport(
  companyId: string,
  input: { storageKey: string; fileName?: string },
  uploadedById?: string,
): Promise<{ importId: string; imported: number; duplicatesSkipped: number }> {
  assertCompanyStorageKey(companyId, input.storageKey, "bank-statements")

  const buffer = await getStoredObject(input.storageKey)
  const preview = await previewBankStatementImport(
    buffer,
    input.fileName || "extracto",
    "application/octet-stream",
  )

  const candidateKeys = preview.movements.map((movement) => buildBankMovementDedupeKey(movement))
  const existingKeys = await loadExistingDedupeKeys(companyId, candidateKeys)
  const { toInsert, duplicatesSkipped } = prepareBankMovementsForInsert(preview.movements, existingKeys)

  const importRecord = await prisma.bankStatementImport.create({
    data: {
      companyId,
      fileName: preview.fileName,
      source: sourceFromPreview(preview.source),
      movementCount: toInsert.length,
      uploadedById,
      storageKey: input.storageKey,
      contentType: "application/octet-stream",
      sha256: hashBufferSha256(buffer),
    },
  })

  try {
    for (const part of chunkArray(toInsert, DB_INSERT_CHUNK_SIZE)) {
      await prisma.bankMovement.createMany({
        data: part.map((movement) => ({
          companyId,
          importId: importRecord.id,
          movementDate: new Date(`${movement.movementDate}T00:00:00.000Z`),
          valueDate: movement.valueDate ? new Date(`${movement.valueDate}T00:00:00.000Z`) : null,
          concept: movement.concept,
          reference: movement.reference ?? null,
          amount: movement.amount,
          balance: movement.balance ?? null,
          dedupeKey: movement.dedupeKey,
        })),
        skipDuplicates: true,
      })
    }
  } catch (error) {
    await prisma.bankMovement.deleteMany({ where: { importId: importRecord.id } })
    await prisma.bankStatementImport.delete({ where: { id: importRecord.id } })
    throw error
  }

  return {
    importId: importRecord.id,
    imported: toInsert.length,
    duplicatesSkipped,
  }
}

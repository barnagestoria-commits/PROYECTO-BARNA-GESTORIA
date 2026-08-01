import type { BankStatementSource } from "@prisma/client"
import { buildBankMovementDedupeKey } from "@/lib/bank-reconciliation/dedupe"
import { extractBankStatementPreview } from "@/lib/bank-reconciliation/extract-bank-statement-ocr"
import { parseBankSpreadsheetBuffer } from "@/lib/bank-reconciliation/parse-bank-spreadsheet"
import type { BankImportPreview, BankMovementDraft } from "@/lib/bank-reconciliation/types"
import { prisma } from "@/lib/db"

function sourceFromPreview(source: BankImportPreview["source"]): BankStatementSource {
  return source
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

export async function confirmBankStatementImport(
  companyId: string,
  preview: BankImportPreview,
  uploadedById?: string,
): Promise<{ importId: string; imported: number; duplicatesSkipped: number }> {
  const existingKeys = new Set(
    (
      await prisma.bankMovement.findMany({
        where: { companyId },
        select: { dedupeKey: true },
      })
    ).map((row) => row.dedupeKey),
  )

  const toInsert: Array<BankMovementDraft & { dedupeKey: string }> = []
  let duplicatesSkipped = 0

  for (const movement of preview.movements) {
    const dedupeKey = buildBankMovementDedupeKey(movement)
    if (existingKeys.has(dedupeKey)) {
      duplicatesSkipped += 1
      continue
    }
    existingKeys.add(dedupeKey)
    toInsert.push({ ...movement, dedupeKey })
  }

  const importRecord = await prisma.bankStatementImport.create({
    data: {
      companyId,
      fileName: preview.fileName,
      source: sourceFromPreview(preview.source),
      movementCount: toInsert.length,
      uploadedById,
    },
  })

  if (toInsert.length > 0) {
    await prisma.bankMovement.createMany({
      data: toInsert.map((movement) => ({
        companyId,
        importId: importRecord.id,
        movementDate: new Date(`${movement.movementDate}T00:00:00.000Z`),
        valueDate: movement.valueDate
          ? new Date(`${movement.valueDate}T00:00:00.000Z`)
          : null,
        concept: movement.concept,
        reference: movement.reference ?? null,
        amount: movement.amount,
        balance: movement.balance ?? null,
        dedupeKey: movement.dedupeKey,
      })),
    })
  }

  return {
    importId: importRecord.id,
    imported: toInsert.length,
    duplicatesSkipped,
  }
}

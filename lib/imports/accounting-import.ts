import { prisma } from "@/lib/db"
import {
  detectAccountingFileFormat,
  parseAccountingFile,
  type AccountingImportRow,
} from "@/lib/imports/parse-accounting-file"

function groupRowsByDate(rows: AccountingImportRow[]): Map<string, AccountingImportRow[]> {
  const groups = new Map<string, AccountingImportRow[]>()
  for (const row of rows) {
    const existing = groups.get(row.fecha) ?? []
    existing.push(row)
    groups.set(row.fecha, existing)
  }
  return groups
}

export async function importAccountingFile(
  companyId: string,
  fileName: string,
  buffer: Buffer,
  uploadedById?: string,
) {
  const format = detectAccountingFileFormat(fileName)

  const importRecord = await prisma.accountingDataImport.create({
    data: {
      companyId,
      fileName,
      format,
      status: "PENDIENTE",
      uploadedById,
    },
  })

  try {
    const rows = parseAccountingFile(buffer, fileName)
    const groups = groupRowsByDate(rows)
    let entriesCreated = 0

    for (const [fecha, groupRows] of groups) {
      const date = new Date(`${fecha}T00:00:00.000Z`)
      if (Number.isNaN(date.getTime())) continue

      await prisma.accountingEntry.create({
        data: {
          companyId,
          fecha: date,
          commandCode: null,
          createdById: uploadedById,
          lines: {
            create: groupRows.map((row, index) => ({
              sortOrder: index,
              cuenta: row.cuenta,
              concepto: row.concepto,
              debe: row.debe,
              haber: row.haber,
            })),
          },
        },
      })
      entriesCreated += 1
    }

    await prisma.accountingDataImport.update({
      where: { id: importRecord.id },
      data: { status: "PROCESADO", rowsImported: rows.length },
    })

    return {
      id: importRecord.id,
      fileName,
      format,
      rowsImported: rows.length,
      status: "PROCESADO" as const,
      entriesCreated,
    }
  } catch (error) {
    await prisma.accountingDataImport.update({
      where: { id: importRecord.id },
      data: {
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Error al importar.",
      },
    })
    throw error
  }
}

export { parseAccountingCsvContent as parseAccountingCsv } from "@/lib/imports/parse-accounting-file"

export async function importAccountingCsv(
  companyId: string,
  fileName: string,
  content: string,
  uploadedById?: string,
) {
  return importAccountingFile(companyId, fileName, Buffer.from(content, "utf-8"), uploadedById)
}

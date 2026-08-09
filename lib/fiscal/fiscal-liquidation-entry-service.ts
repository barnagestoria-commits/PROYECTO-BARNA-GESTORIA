import { prisma } from "@/lib/db"
import { createAccountingEntry } from "@/lib/accounting/entry-service"
import {
  buildVatLiquidationLines,
  calculateVatLiquidation,
} from "@/lib/accounting/vat-liquidation-service"
import { calculateModelAmount, getQuarterDateRange } from "@/lib/fiscal/panorama"
import type { FiscalModelId } from "@/lib/types/fiscal-panorama"
import type { RawEntryLine } from "@/lib/fiscal/panorama"

function padAccount12(prefix: string): string {
  return prefix.replace(/\D/g, "").padEnd(12, "0")
}

async function fetchYearLines(companyId: string, year: number): Promise<RawEntryLine[]> {
  const start = new Date(`${year}-01-01T00:00:00.000Z`)
  const end = new Date(`${year}-12-31T23:59:59.999Z`)

  const lines = await prisma.entryLine.findMany({
    where: {
      entry: { companyId, fecha: { gte: start, lte: end } },
    },
    include: {
      entry: { select: { id: true, fecha: true, commandCode: true } },
    },
    orderBy: [{ entry: { fecha: "asc" } }, { sortOrder: "asc" }],
  })

  return lines.map((line) => ({
    id: line.id,
    entryId: line.entryId,
    cuenta: line.cuenta,
    concepto: line.concepto,
    debe: line.debe,
    haber: line.haber,
    entry: {
      id: line.entry.id,
      fecha: line.entry.fecha,
      concepto: line.entry.commandCode,
    },
  }))
}

export async function generateFiscalLiquidationEntry(params: {
  companyId: string
  userId: string
  modelCode: FiscalModelId
  year: number
  quarter: 1 | 2 | 3 | 4
}): Promise<{ entryId: string; refNumber: number; message: string }> {
  const { end } = getQuarterDateRange(params.year, params.quarter)
  const fecha = end.toISOString().split("T")[0]

  if (params.modelCode === "303") {
    const liquidation = await calculateVatLiquidation({
      companyId: params.companyId,
      year: params.year,
      quarter: params.quarter,
    })

    if (liquidation.settlementAmount <= 0 && liquidation.saldoRepercutido === 0 && liquidation.saldoSoportado === 0) {
      throw new Error("No hay saldos de IVA en el periodo para generar la liquidación.")
    }

    const concept = `Modelo 303 ${params.quarter} Trimestre`
    const rawLines = buildVatLiquidationLines({
      ...liquidation,
      concept,
    }).map((line) => ({
      cuenta: padAccount12(line.cuenta),
      concepto: concept,
      debe: line.debe,
      haber: line.haber,
    }))

    const entry = await createAccountingEntry(params.companyId, params.userId, {
      fecha,
      commandCode: "303",
      lines: rawLines,
    })

    return {
      entryId: entry.id,
      refNumber: entry.refNumber,
      message: `Asiento de liquidación generado con éxito (Asiento N.º ${entry.refNumber}).`,
    }
  }

  if (params.modelCode === "111") {
    const allLines = await fetchYearLines(params.companyId, params.year)
    const result = calculateModelAmount("111", allLines, params.year, params.quarter)

    if (Math.abs(result.amount) < 0.01) {
      throw new Error("No hay retenciones practicadas en el periodo para generar el asiento.")
    }

    const concept = `Modelo 111 ${params.quarter} Trimestre`
    const amount = Math.abs(result.amount)

    const entry = await createAccountingEntry(params.companyId, params.userId, {
      fecha,
      commandCode: "57",
      lines: [
        {
          cuenta: padAccount12("475101"),
          concepto: concept,
          debe: amount,
          haber: 0,
        },
        {
          cuenta: padAccount12("473"),
          concepto: concept,
          debe: 0,
          haber: amount,
        },
      ],
    })

    return {
      entryId: entry.id,
      refNumber: entry.refNumber,
      message: `Asiento de liquidación generado con éxito (Asiento N.º ${entry.refNumber}).`,
    }
  }

  throw new Error(`La generación automática de asientos no está disponible para el modelo ${params.modelCode}.`)
}

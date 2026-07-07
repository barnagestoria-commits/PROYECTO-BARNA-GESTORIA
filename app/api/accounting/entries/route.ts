import { NextResponse } from "next/server"
import type { Decimal } from "@prisma/client/runtime/library"
import { prisma } from "@/lib/db"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  ACCOUNTING_COMMANDS,
  calculateTotals,
} from "@/lib/accounting/command-templates"
import type {
  AccountingCommandCode,
  AccountingEntryLine,
  AccountingEntryResponse,
  CreateAccountingEntryRequest,
} from "@/lib/types/accounting-entry"

const COMMAND_CODES = new Set(Object.keys(ACCOUNTING_COMMANDS))

function decimalToNumber(value: Decimal | number): number {
  return typeof value === "number" ? value : Number(value)
}

function parseFecha(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeLines(
  rawLines: CreateAccountingEntryRequest["lines"],
): { lines: Omit<AccountingEntryLine, "id">[] } | { error: string } {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return { error: "El asiento debe incluir al menos una línea." }
  }

  const lines = rawLines
    .map((line) => ({
      cuenta: String(line.cuenta ?? "").trim(),
      concepto: String(line.concepto ?? "").trim(),
      debe: Math.round((Number(line.debe) || 0) * 100) / 100,
      haber: Math.round((Number(line.haber) || 0) * 100) / 100,
    }))
    .filter((line) => line.cuenta || line.debe > 0 || line.haber > 0)

  if (lines.length === 0) {
    return { error: "Introduce al menos una línea con cuenta o importe." }
  }

  const missingCuenta = lines.some((line) => !line.cuenta)
  if (missingCuenta) {
    return { error: "Todas las líneas con importe deben tener cuenta contable." }
  }

  return { lines }
}

function toResponseEntry(
  entry: {
    id: string
    companyId: string
    fecha: Date
    commandCode: string | null
    createdAt: Date
    lines: Array<{
      id: string
      sortOrder: number
      cuenta: string
      concepto: string
      debe: Decimal | number
      haber: Decimal | number
    }>
  },
): AccountingEntryResponse {
  const lines = entry.lines
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((line) => ({
      id: line.id,
      sortOrder: line.sortOrder,
      cuenta: line.cuenta,
      concepto: line.concepto,
      debe: decimalToNumber(line.debe),
      haber: decimalToNumber(line.haber),
    }))

  const totals = calculateTotals(
    lines.map((line) => ({ ...line, id: line.id })),
  )

  return {
    id: entry.id,
    companyId: entry.companyId,
    fecha: entry.fecha.toISOString().split("T")[0],
    commandCode: entry.commandCode as AccountingCommandCode | null,
    lines,
    totals,
    createdAt: entry.createdAt.toISOString(),
  }
}

export async function POST(request: Request) {
  try {
    const { session, companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as CreateAccountingEntryRequest

    const fecha = parseFecha(body.fecha)
    if (!fecha) {
      return NextResponse.json({ success: false, error: "Fecha no válida." }, { status: 400 })
    }

    const commandCode =
      body.commandCode && COMMAND_CODES.has(body.commandCode) ? body.commandCode : null

    const normalized = normalizeLines(body.lines)
    if ("error" in normalized) {
      return NextResponse.json({ success: false, error: normalized.error }, { status: 400 })
    }

    const totals = calculateTotals(
      normalized.lines.map((line, index) => ({
        ...line,
        id: `temp-${index}`,
      })),
    )

    if (!totals.isBalanced) {
      return NextResponse.json(
        {
          success: false,
          error: `El asiento está descuadrado (diferencia ${Math.abs(totals.difference).toFixed(2)} €).`,
        },
        { status: 400 },
      )
    }

    const entry = await prisma.accountingEntry.create({
      data: {
        companyId,
        fecha,
        commandCode,
        createdById: session.user.id,
        lines: {
          create: normalized.lines.map((line, index) => ({
            sortOrder: index,
            cuenta: line.cuenta,
            concepto: line.concepto,
            debe: line.debe,
            haber: line.haber,
          })),
        },
      },
      include: { lines: true },
    })

    return NextResponse.json({
      success: true,
      entry: toResponseEntry(entry),
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}

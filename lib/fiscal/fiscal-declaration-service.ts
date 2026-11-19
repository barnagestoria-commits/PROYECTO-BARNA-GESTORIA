import type { FiscalDeclarationStatus, FiscalModelCode } from "@prisma/client"
import { prisma } from "@/lib/db"
import { FISCAL_MODEL_DEFINITIONS, prismaCodeToModelId } from "@/lib/fiscal/panorama"
import type { FiscalModelId, FiscalPeriodKey } from "@/lib/types/fiscal-panorama"

/** Periodo anual en modelos 347, 390, etc. */
export const FISCAL_ANNUAL_DECLARATION_QUARTER = 0

export type FiscalDeclarationDto = {
  status: FiscalDeclarationStatus
  submittedAt: string | null
  notes: string | null
  updatedAt: string
}

export function isFiscalModelId(value: string): value is FiscalModelId {
  return FISCAL_MODEL_DEFINITIONS.some((model) => model.code === value)
}

export function modelIdToPrismaCode(modelId: FiscalModelId): FiscalModelCode {
  const model = FISCAL_MODEL_DEFINITIONS.find((item) => item.code === modelId)
  if (!model) throw new Error("Modelo fiscal no válido.")
  return model.prismaCode
}

export function periodKeyToDeclarationQuarter(period: FiscalPeriodKey): number {
  if (period === "annual") return FISCAL_ANNUAL_DECLARATION_QUARTER
  return Number(period.replace("q", ""))
}

export function declarationQuarterToPeriodKey(quarter: number): FiscalPeriodKey | null {
  if (quarter === FISCAL_ANNUAL_DECLARATION_QUARTER) return "annual"
  if (quarter >= 1 && quarter <= 4) return `q${quarter}` as FiscalPeriodKey
  return null
}

function toDto(row: {
  status: FiscalDeclarationStatus
  submittedAt: Date | null
  notes: string | null
  updatedAt: Date
}): FiscalDeclarationDto {
  return {
    status: row.status,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getFiscalDeclaration(
  companyId: string,
  modelId: FiscalModelId,
  year: number,
  quarter: number,
): Promise<FiscalDeclarationDto | null> {
  const row = await prisma.fiscalDeclaration.findUnique({
    where: {
      companyId_year_quarter_modelCode: {
        companyId,
        year,
        quarter,
        modelCode: modelIdToPrismaCode(modelId),
      },
    },
  })
  return row ? toDto(row) : null
}

export type UpsertFiscalDeclarationInput = {
  modelCode: FiscalModelId
  year: number
  quarter: number
  status: FiscalDeclarationStatus
  notes?: string | null
  submittedAt?: string | null
}

export async function upsertFiscalDeclaration(
  companyId: string,
  input: UpsertFiscalDeclarationInput,
): Promise<FiscalDeclarationDto> {
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    throw new Error("Ejercicio no válido.")
  }
  if (input.quarter !== FISCAL_ANNUAL_DECLARATION_QUARTER && (input.quarter < 1 || input.quarter > 4)) {
    throw new Error("Periodo no válido.")
  }
  const allowed: FiscalDeclarationStatus[] = ["PENDIENTE", "PRESENTADO", "SIN_DATOS"]
  if (!allowed.includes(input.status)) {
    throw new Error("Estado no válido.")
  }

  let submittedAt: Date | null = null
  if (input.submittedAt) {
    const parsed = new Date(input.submittedAt)
    if (Number.isNaN(parsed.getTime())) throw new Error("Fecha de presentación no válida.")
    submittedAt = parsed
  } else if (input.status === "PRESENTADO") {
    submittedAt = new Date()
  }

  const notes =
    input.notes === undefined ? undefined : input.notes?.trim() ? input.notes.trim() : null

  const row = await prisma.fiscalDeclaration.upsert({
    where: {
      companyId_year_quarter_modelCode: {
        companyId,
        year: input.year,
        quarter: input.quarter,
        modelCode: modelIdToPrismaCode(input.modelCode),
      },
    },
    create: {
      companyId,
      year: input.year,
      quarter: input.quarter,
      modelCode: modelIdToPrismaCode(input.modelCode),
      status: input.status,
      submittedAt,
      notes: notes ?? null,
    },
    update: {
      status: input.status,
      submittedAt,
      ...(notes !== undefined ? { notes } : {}),
    },
  })

  return toDto(row)
}

export async function clearFiscalDeclaration(
  companyId: string,
  modelId: FiscalModelId,
  year: number,
  quarter: number,
): Promise<void> {
  await prisma.fiscalDeclaration.deleteMany({
    where: {
      companyId,
      year,
      quarter,
      modelCode: modelIdToPrismaCode(modelId),
    },
  })
}

/** Cuando Taxlyn presente en la Sede con CIF, llamar aquí para marcar presentado automáticamente. */
export async function markFiscalDeclarationPresentedFromTaxlyn(
  companyId: string,
  modelId: FiscalModelId,
  year: number,
  quarter: number,
  notes?: string | null,
): Promise<FiscalDeclarationDto> {
  return upsertFiscalDeclaration(companyId, {
    modelCode: modelId,
    year,
    quarter,
    status: "PRESENTADO",
    submittedAt: new Date().toISOString(),
    notes: notes ?? null,
  })
}

export { prismaCodeToModelId }
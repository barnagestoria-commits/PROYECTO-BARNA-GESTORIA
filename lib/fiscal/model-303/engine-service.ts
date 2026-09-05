import { createHash } from "node:crypto"
import { Prisma, TaxExportFormat, TaxReturnStatus } from "@prisma/client"
import {
  defaultAeatSourceRegistry,
  exportModel303Dr303,
  type AeatOfficialSourceMeta,
  type TaxCasillaValue,
  type TaxExportArtifact,
  type TaxReturnContext,
} from "@gestoria/tax-engine"
import { prisma } from "@/lib/db"
import {
  buildTaxEngine303Casillas,
  buildTaxEngine303Context,
} from "@/lib/fiscal/aeat/tax-engine-bridge"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

export interface Model303EngineResult {
  context: TaxReturnContext
  casillas: TaxCasillaValue[]
  artifact: TaxExportArtifact
  source: AeatOfficialSourceMeta
}

export interface Model303EngineSummary {
  engine: "@gestoria/tax-engine"
  modelCode: "303"
  versionKey: string
  format: "dr303-envelope"
  filename: string
  byteLength: number
  valid: boolean
  issues: TaxExportArtifact["validation"]["issues"]
  casillas: Array<{ code: string; amount: number; sourceCount: number }>
  source: AeatOfficialSourceMeta
}

function requireModel303Source(year: number): AeatOfficialSourceMeta {
  const source = defaultAeatSourceRegistry.getActiveForModel("303", year)
  if (!source) {
    throw new Error(`No existe un diseño oficial AEAT registrado para el modelo 303 del ejercicio ${year}.`)
  }
  return source
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export function buildModel303EngineResult(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Model303EngineResult {
  if (detail.modelCode !== "303" || detail.quarter === "annual") {
    throw new Error("El motor DR303 solo admite el modelo 303 en periodos trimestrales.")
  }

  const source = requireModel303Source(detail.year)
  const context = {
    ...buildTaxEngine303Context(detail, companyName, companyCif),
    versionKey: source.id,
  }
  const casillas = buildTaxEngine303Casillas(detail)
  const artifact = exportModel303Dr303({ context, casillas })

  return { context, casillas, artifact, source }
}

export function summarizeModel303EngineResult(result: Model303EngineResult): Model303EngineSummary {
  return {
    engine: "@gestoria/tax-engine",
    modelCode: "303",
    versionKey: result.context.versionKey ?? result.source.id,
    format: "dr303-envelope",
    filename: result.artifact.filename,
    byteLength: result.artifact.byteLength,
    valid: result.artifact.validation.valid,
    issues: result.artifact.validation.issues,
    casillas: result.casillas.map((casilla) => ({
      code: casilla.casilla,
      amount: casilla.amount,
      sourceCount: casilla.sources?.length ?? 0,
    })),
    source: result.source,
  }
}

interface PersistModel303Options {
  companyId: string
  detail: FiscalModelDetailResponse
  companyName: string
  companyCif: string | null | undefined
  eventType: "DRAFT_VALIDATED" | "EXPORT_GENERATED"
}

export async function persistModel303EngineResult(options: PersistModel303Options): Promise<{
  taxReturnId: string
  artifact: TaxExportArtifact
}> {
  const result = buildModel303EngineResult(
    options.detail,
    options.companyName,
    options.companyCif,
  )
  const { artifact, casillas, context, source } = result
  const status = artifact.validation.valid ? TaxReturnStatus.VALIDATED : TaxReturnStatus.DRAFT
  const sha256 = createHash("sha256").update(artifact.content).digest("hex")

  const taxReturnId = await prisma.$transaction(async (tx) => {
    const version = await tx.taxModelVersion.upsert({
      where: { versionKey: source.id },
      update: {
        sourceLabel: source.label,
        sourceUrl: source.url,
        sha256Prefix: source.sha256Prefix,
        effectiveFrom: new Date(`${source.effectiveFrom}T00:00:00.000Z`),
      },
      create: {
        versionKey: source.id,
        modelCode: source.modelCode,
        exercise: source.exercise,
        periodScope: "TRIM",
        revision: source.revision,
        sourceLabel: source.label,
        sourceUrl: source.url,
        sha256Prefix: source.sha256Prefix,
        format: TaxExportFormat.DR303_ENVELOPE,
        effectiveFrom: new Date(`${source.effectiveFrom}T00:00:00.000Z`),
      },
    })

    const existingSource = await tx.taxModelSource.findFirst({
      where: { versionId: version.id, url: source.url },
      select: { id: true },
    })
    if (!existingSource) {
      await tx.taxModelSource.create({
        data: {
          versionId: version.id,
          label: source.label,
          url: source.url,
        },
      })
    }

    const returnKey = {
      companyId: options.companyId,
      versionId: version.id,
      year: context.year,
      period: context.period,
    }
    const existingReturn = await tx.taxReturn.findUnique({
      where: { companyId_versionId_year_period: returnKey },
      select: { id: true, status: true },
    })
    if (existingReturn?.status === TaxReturnStatus.SUBMITTED) {
      throw new Error("La declaración ya fue presentada y no puede regenerarse ni sobrescribirse.")
    }

    const taxReturn = await tx.taxReturn.upsert({
      where: {
        companyId_versionId_year_period: returnKey,
      },
      update: { status },
      create: {
        companyId: options.companyId,
        versionId: version.id,
        year: context.year,
        period: context.period,
        status,
      },
    })

    await Promise.all([
      tx.taxReturnValue.deleteMany({ where: { returnId: taxReturn.id } }),
      tx.taxFact.deleteMany({ where: { returnId: taxReturn.id } }),
      tx.taxValidationResult.deleteMany({ where: { returnId: taxReturn.id } }),
    ])

    for (const casilla of casillas) {
      const sources = casilla.sources ?? []
      await tx.taxReturnValue.create({
        data: {
          returnId: taxReturn.id,
          casilla: casilla.casilla,
          amount: new Prisma.Decimal(casilla.amount),
          sources: sources.length
            ? {
                createMany: {
                  data: sources.map((item) => ({
                    entryId: item.entryId,
                    lineId: item.lineId,
                    concept: item.concept,
                    accountCode: item.accountCode,
                  })),
                },
              }
            : undefined,
        },
      })

      if (casilla.amount !== 0) {
        await tx.taxFact.create({
          data: {
            companyId: options.companyId,
            returnId: taxReturn.id,
            modelCode: "303",
            year: context.year,
            period: context.period,
            factType: "CASILLA_303",
            casilla: casilla.casilla,
            amount: new Prisma.Decimal(casilla.amount),
            payload: toJsonValue({ sources }),
          },
        })
      }
    }

    await tx.taxValidationResult.create({
      data: {
        returnId: taxReturn.id,
        valid: artifact.validation.valid,
        format: artifact.format,
        issues: toJsonValue(artifact.validation.issues),
      },
    })

    if (options.eventType === "EXPORT_GENERATED") {
      await tx.taxExportArtifact.create({
        data: {
          returnId: taxReturn.id,
          filename: artifact.filename,
          format: TaxExportFormat.DR303_ENVELOPE,
          byteSize: artifact.byteLength,
          sha256,
        },
      })
      await tx.taxReturn.update({
        where: { id: taxReturn.id },
        data: { status: TaxReturnStatus.EXPORTED },
      })
    }

    await tx.taxAuditEvent.create({
      data: {
        returnId: taxReturn.id,
        eventType: options.eventType,
        message:
          options.eventType === "EXPORT_GENERATED"
            ? `Fichero ${artifact.filename} generado y validado por @gestoria/tax-engine.`
            : "Borrador 303 calculado y validado por @gestoria/tax-engine.",
        payload: {
          format: artifact.format,
          valid: artifact.validation.valid,
          byteLength: artifact.byteLength,
          sha256,
        },
      },
    })

    return taxReturn.id
  })

  return { taxReturnId, artifact }
}

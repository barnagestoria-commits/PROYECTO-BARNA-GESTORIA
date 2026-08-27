import { StandardFonts } from "pdf-lib"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import {
  buildModelo111OverlayFields,
  MODELO_111_IDENTITY,
} from "@/lib/fiscal/official-pdf/field-maps/modelo-111"
import {
  buildModelo303OverlayFieldsFromCasillas,
  MODELO_303_IDENTITY,
} from "@/lib/fiscal/official-pdf/field-maps/modelo-303"
import {
  buildModelo349OverlayFields,
  MODELO_349_IDENTITY,
} from "@/lib/fiscal/official-pdf/field-maps/modelo-349"
import {
  buildGenericOverlayFields,
  GENERIC_IDENTITY,
} from "@/lib/fiscal/official-pdf/field-maps/generic"
import {
  drawIdentityBlock,
  drawOverlayField,
  finalizeDraftPdf,
  loadOfficialTemplate,
  type OverlayDraftContext,
  type OverlayTextField,
} from "@/lib/fiscal/official-pdf/overlay-utils"
import { formatAeatPeriod, sanitizeAeatText } from "@/lib/fiscal/official-pdf/format-aeat-value"
import type { FiscalModelId } from "@/lib/types/fiscal-panorama"
import type { TaxCasillaValue } from "@gestoria/tax-engine"
import { buildTaxEngine303Casillas } from "@/lib/fiscal/aeat/tax-engine-bridge"
import { existsSync } from "node:fs"
import { join } from "node:path"

const TEMPLATE_SUPPORTED_MODELS = new Set<FiscalModelId>([
  "111",
  "115",
  "123",
  "303",
  "347",
  "349",
  "390",
  "190",
  "180",
])

const TEMPLATE_ALIASES: Partial<Record<FiscalModelId, FiscalModelId>> = {
  "115": "111",
  "180": "190",
}

export function hasOfficialDraftTemplate(modelCode: FiscalModelId): boolean {
  if (!TEMPLATE_SUPPORTED_MODELS.has(modelCode)) return false
  const resolved = TEMPLATE_ALIASES[modelCode] ?? modelCode
  const templatePath = join(process.cwd(), "assets", "aeat-templates", `modelo-${resolved}.pdf`)
  return existsSync(templatePath)
}

function resolveOverlayPlan(
  detail: FiscalModelDetailResponse,
  model303Casillas?: TaxCasillaValue[],
): {
  identity: {
    nif: OverlayTextField
    companyName: OverlayTextField
    year: OverlayTextField
    period: OverlayTextField
  }
  fields: Array<{ field: OverlayTextField; value: number }>
} {
  switch (detail.modelCode) {
    case "303":
      return {
        identity: MODELO_303_IDENTITY,
        fields: buildModelo303OverlayFieldsFromCasillas(model303Casillas ?? []),
      }
    case "111":
      return {
        identity: MODELO_111_IDENTITY,
        fields: buildModelo111OverlayFields(detail),
      }
    case "349":
      return {
        identity: MODELO_349_IDENTITY,
        fields: buildModelo349OverlayFields(detail),
      }
    default:
      return {
        identity: GENERIC_IDENTITY,
        fields: buildGenericOverlayFields(detail),
      }
  }
}

export async function generateOfficialDraftPdf(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Promise<Buffer> {
  if (!hasOfficialDraftTemplate(detail.modelCode)) {
    throw new Error(`No hay plantilla oficial PDF para el modelo ${detail.modelCode}.`)
  }

  const templateModel = TEMPLATE_ALIASES[detail.modelCode] ?? detail.modelCode
  const doc = await loadOfficialTemplate(templateModel)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()

  const context: OverlayDraftContext = {
    nif: sanitizeAeatText(companyCif ?? "", 9),
    companyName: sanitizeAeatText(companyName, 40),
    year: detail.year,
    period: formatAeatPeriod(detail.quarter),
  }

  const model303Casillas =
    detail.modelCode === "303"
      ? buildTaxEngine303Casillas(detail)
      : undefined
  const plan = resolveOverlayPlan(detail, model303Casillas)
  drawIdentityBlock(pages, plan.identity, context, font)

  for (const { field, value } of plan.fields) {
    const page = pages[field.page]
    if (!page) continue
    drawOverlayField(page, field, value, font)
  }

  return finalizeDraftPdf(doc)
}

export function buildOfficialDraftPdfFilename(
  detail: Pick<FiscalModelDetailResponse, "modelCode" | "year" | "quarter">,
  companyName: string,
): string {
  const quarterSuffix = detail.quarter === "annual" ? "anual" : `${detail.quarter}T`
  const slug = companyName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
  return `borrador-modelo-${detail.modelCode}-${slug}-${detail.year}-${quarterSuffix}.pdf`
}

import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import type { DraftCasilla, DraftSection, FiscalModelDraft } from "@/lib/fiscal/model-draft/types"
import { DRAFT_SUPPORTED_MODELS } from "@/lib/fiscal/model-draft/types"

function sectionTotal(
  detail: FiscalModelDetailResponse,
  key: string,
): number {
  return detail.breakdown.find((section) => section.key === key)?.total ?? 0
}

function casilla(
  id: string,
  code: string,
  label: string,
  amount: number,
  sectionKey: string,
  description?: string,
): DraftCasilla {
  return {
    id,
    code,
    label,
    description,
    amount,
    sectionKey,
    clickable: true,
  }
}

function build303Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const repercutido = sectionTotal(detail, "repercutido")
  const soportado = sectionTotal(detail, "soportado")
  const liquidacion = sectionTotal(detail, "liquidacion")

  if (detail.breakdown.some((section) => section.key === "liquidacion")) {
    return [
      {
        id: "liquidacion",
        title: "Liquidación trimestral",
        casillas: [
          casilla(
            "liq-03",
            "03",
            "Resultado de la liquidación",
            detail.amount,
            "liquidacion",
            "Importe de la liquidación registrada en contabilidad",
          ),
        ],
      },
    ]
  }

  return [
    {
      id: "iva-repercutido",
      title: "IVA devengado — Cuotas repercutidas",
      casillas: [
        casilla("303-01", "01", "Cuota del IVA repercutido", repercutido, "repercutido"),
      ],
    },
    {
      id: "iva-soportado",
      title: "IVA deducible — Cuotas soportadas",
      casillas: [
        casilla("303-02", "02", "Cuota del IVA soportado", soportado, "soportado"),
      ],
    },
    {
      id: "resultado",
      title: "Resultado de la liquidación",
      casillas: [
        casilla(
          "303-03",
          "03",
          detail.amount >= 0 ? "Total a ingresar" : "Total a compensar / devolver",
          detail.amount,
          "resultado",
        ),
        ...(liquidacion !== 0
          ? [casilla("303-liq", "LQ", "Liquidación registrada", liquidacion, "liquidacion")]
          : []),
      ],
    },
  ]
}

function buildRetentionSections(detail: FiscalModelDetailResponse): DraftSection[] {
  return detail.breakdown.map((section) => ({
    id: section.key,
    title: section.label,
    casillas: [
      casilla(
        `${section.key}-total`,
        section.key === "retenciones" ? "01" : "01",
        section.label,
        section.total,
        section.key,
      ),
    ],
  }))
}

function build111Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const sections = buildRetentionSections(detail)
  if (sections.length === 0) {
    return [
      {
        id: "retenciones",
        title: "Retenciones e ingresos a cuenta",
        casillas: [casilla("111-01", "01", "Total retenciones practicadas", detail.amount, "retenciones")],
      },
    ]
  }
  return sections
}

function build123Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const base = buildRetentionSections(detail)
  return base.map((section) => ({
    ...section,
    casillas: section.casillas.map((cell) => ({
      ...cell,
      code: cell.code === "01" ? "04" : cell.code,
      label: cell.label.includes("Retenciones") ? cell.label : "Retenciones e ingresos a cuenta",
    })),
  }))
}

function build349Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const operadores = new Set(
    detail.breakdown.flatMap((section) => section.lines.map((line) => line.entryId)),
  ).size

  return [
    {
      id: "intracomunitarias",
      title: "Operaciones intracomunitarias",
      casillas: [
        casilla("349-01", "01", "Número de operadores comunitarios", operadores, "intracomunitarias"),
        casilla(
          "349-02",
          "02",
          "Importe de las operaciones intracomunitarias",
          detail.amount,
          "intracomunitarias",
        ),
      ],
    },
  ]
}

export function buildFiscalModelDraft(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): FiscalModelDraft {
  let sections: DraftSection[] = []

  switch (detail.modelCode) {
    case "303":
      sections = build303Sections(detail)
      break
    case "111":
      sections = build111Sections(detail)
      break
    case "115":
      sections = buildRetentionSections(detail)
      break
    case "123":
      sections = build123Sections(detail)
      break
    case "349":
      sections = build349Sections(detail)
      break
    default:
      sections = buildRetentionSections(detail)
  }

  const hasExistingLiquidation = detail.breakdown.some(
    (section) => section.key === "liquidacion" || section.key === "nrc-pago",
  )

  return {
    modelCode: detail.modelCode,
    modelLabel: detail.modelLabel,
    year: detail.year,
    quarter: detail.quarter,
    periodLabel: detail.periodLabel,
    nif: (companyCif ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase() || "—",
    companyName,
    status: detail.status,
    statusLabel: detail.statusLabel,
    sections,
    resultAmount: detail.amount,
    supportsGenerateEntry:
      DRAFT_SUPPORTED_MODELS.has(detail.modelCode) &&
      detail.quarter !== "annual" &&
      (detail.modelCode === "303" || detail.modelCode === "111"),
    hasExistingLiquidation,
  }
}

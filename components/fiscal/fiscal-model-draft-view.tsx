"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FiscalExportButtons } from "@/components/report-export-buttons"
import { FiscalCalculationDetailDialog } from "@/components/fiscal/fiscal-calculation-detail-dialog"
import { EditAccountingEntryDialog } from "@/components/accounting/edit-accounting-entry-dialog"
import { buildFiscalModelDraft } from "@/lib/fiscal/model-draft/build-model-draft"
import { buildCalculationDetailRows } from "@/lib/fiscal/model-draft/calculation-rows"
import { DRAFT_SUPPORTED_MODELS, type DraftCasilla, type DraftSection } from "@/lib/fiscal/model-draft/types"
import {
  getDraftTableLayout,
  getResultCasillaLabel,
  resolveDraftResultAmount,
} from "@/lib/fiscal/official-layouts"
import { formatFiscalAmount } from "@/lib/fiscal/panorama"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import { apiFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import {
  FileText,
  Loader2,
  RefreshCw,
  Calculator,
  BookOpenCheck,
} from "lucide-react"

interface FiscalModelDraftViewProps {
  detail: FiscalModelDetailResponse
  companyName: string
  companyCif: string | null | undefined
  modelParam: string
  quarterParam: string
  year: number
  onRefresh: () => Promise<void>
}

function statusBadgeClass(status: FiscalModelDetailResponse["status"]): string {
  switch (status) {
    case "presentado":
      return "border-emerald-300 bg-emerald-100 text-emerald-800"
    case "pendiente":
      return "border-red-300 bg-red-100 text-red-800"
    case "sin_datos":
      return "border-red-300 bg-red-50 text-red-700"
  }
}

function formatCasillaCode(cell: DraftCasilla): string {
  if (cell.relatedCode) return `[${cell.code}] · [${cell.relatedCode}]`
  return `[${cell.code}]`
}

function Model303SectionTable({
  section,
  onOpenDetail,
}: {
  section: DraftSection
  onOpenDetail: (sectionKey?: string, title?: string) => void
}) {
  return (
    <div className="border-b border-graphite-200 last:border-b-0">
      <div className="bg-[#eef3f8] px-4 py-2 text-xs font-bold uppercase tracking-wide text-graphite-700">
        {section.title}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-graphite-200 bg-[#f8fafc] text-xs uppercase tracking-wide text-graphite-500">
            <tr>
              <th className="w-28 px-4 py-2 text-left">Casilla</th>
              <th className="px-2 py-2 text-left">Concepto</th>
              <th className="w-36 px-4 py-2 text-right">Base imponible</th>
              <th className="w-36 px-4 py-2 text-right">Cuota</th>
            </tr>
          </thead>
          <tbody>
            {section.casillas.map((cell) => (
              <tr key={cell.id} className="border-t border-graphite-100 hover:bg-emerald-50/30">
                <td className="px-4 py-2.5 font-mono text-xs font-bold text-emerald-900">
                  {formatCasillaCode(cell)}
                </td>
                <td className="px-2 py-2.5 text-graphite-800">
                  <button
                    type="button"
                    className="text-left hover:text-emerald-800 hover:underline"
                    onClick={() => onOpenDetail(cell.sectionKey, `${cell.label} — ${formatCasillaCode(cell)}`)}
                  >
                    {cell.label}
                  </button>
                  {cell.description ? (
                    <p className="text-xs text-graphite-500">{cell.description}</p>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    className="font-mono text-sm tabular-nums text-graphite-700 hover:text-emerald-800 hover:underline"
                    onClick={() => onOpenDetail(cell.sectionKey, `${cell.label} — Base`)}
                  >
                    {cell.baseAmount !== undefined ? formatFiscalAmount(cell.baseAmount) : "—"}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    className="font-mono text-sm font-semibold tabular-nums text-graphite-900 hover:text-emerald-800 hover:underline"
                    onClick={() => onOpenDetail(cell.sectionKey, `${cell.label} — Cuota`)}
                  >
                    {formatFiscalAmount(cell.amount)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function isCountCasilla(cell: DraftCasilla, section: DraftSection): boolean {
  return (
    cell.label.toLowerCase().includes("número") ||
    cell.label.toLowerCase().includes("numero") ||
    cell.label.toLowerCase().includes("perceptores") ||
    cell.label.toLowerCase().includes("declarados") ||
    cell.label.toLowerCase().includes("operadores")
  )
}

function formatCellAmount(cell: DraftCasilla, section: DraftSection): string {
  if (isCountCasilla(cell, section)) {
    return String(Math.round(cell.amount))
  }
  return formatFiscalAmount(cell.amount)
}

function RetentionSectionTable({
  section,
  onOpenDetail,
}: {
  section: DraftSection
  onOpenDetail: (sectionKey?: string, title?: string) => void
}) {
  return (
    <div className="border-b border-graphite-200 last:border-b-0">
      <div className="bg-[#eef3f8] px-4 py-2 text-xs font-bold uppercase tracking-wide text-graphite-700">
        {section.title}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-graphite-200 bg-[#f8fafc] text-xs uppercase tracking-wide text-graphite-500">
            <tr>
              <th className="w-28 px-4 py-2 text-left">Casilla</th>
              <th className="px-2 py-2 text-left">Concepto</th>
              <th className="w-36 px-4 py-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {section.casillas.map((cell) => (
              <tr key={cell.id} className="border-t border-graphite-100 hover:bg-emerald-50/30">
                <td className="px-4 py-2.5 font-mono text-xs font-bold text-emerald-900">
                  {formatCasillaCode(cell)}
                </td>
                <td className="px-2 py-2.5 text-graphite-800">
                  <button
                    type="button"
                    className="text-left hover:text-emerald-800 hover:underline"
                    onClick={() => onOpenDetail(cell.sectionKey, `${cell.label} — ${formatCasillaCode(cell)}`)}
                  >
                    {cell.label}
                  </button>
                  {cell.description ? (
                    <p className="text-xs text-graphite-500">{cell.description}</p>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    className="font-mono text-sm font-semibold tabular-nums text-graphite-900 hover:text-emerald-800 hover:underline"
                    onClick={() => onOpenDetail(cell.sectionKey, `${cell.label} — Casilla ${cell.code}`)}
                  >
                    {formatCellAmount(cell, section)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GenericSectionTable({
  section,
  onOpenDetail,
}: {
  section: DraftSection
  onOpenDetail: (sectionKey?: string, title?: string) => void
}) {
  return (
    <div className="border-b border-graphite-200 last:border-b-0">
      <div className="bg-[#eef3f8] px-4 py-2 text-xs font-bold uppercase tracking-wide text-graphite-700">
        {section.title}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {section.casillas.map((cell) => (
            <tr key={cell.id} className="border-t border-graphite-100 hover:bg-emerald-50/30">
              <td className="w-16 px-4 py-2.5 text-center font-mono text-xs font-bold text-emerald-900">
                [{cell.code}]
              </td>
              <td className="px-2 py-2.5 text-graphite-800">
                <button
                  type="button"
                  className="text-left hover:text-emerald-800 hover:underline"
                  onClick={() => onOpenDetail(cell.sectionKey, `${cell.label} — Casilla ${cell.code}`)}
                >
                  {cell.label}
                </button>
                {cell.description ? (
                  <p className="text-xs text-graphite-500">{cell.description}</p>
                ) : null}
              </td>
              <td className="px-4 py-2.5 text-right">
                <button
                  type="button"
                  className="font-mono text-sm font-semibold tabular-nums text-graphite-900 hover:text-emerald-800 hover:underline"
                  onClick={() => onOpenDetail(cell.sectionKey, `${cell.label} — Casilla ${cell.code}`)}
                >
                  {formatCellAmount(cell, section)}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FiscalModelDraftView({
  detail,
  companyName,
  companyCif,
  modelParam,
  quarterParam,
  year,
  onRefresh,
}: FiscalModelDraftViewProps) {
  const draft = useMemo(
    () => buildFiscalModelDraft(detail, companyName, companyCif),
    [detail, companyName, companyCif],
  )

  const resultAmount = useMemo(() => resolveDraftResultAmount(detail), [detail])

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTitle, setDetailTitle] = useState("Datos del cálculo")
  const [detailSectionKey, setDetailSectionKey] = useState<string | undefined>()
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const detailRows = useMemo(
    () => buildCalculationDetailRows(detail, detailSectionKey),
    [detail, detailSectionKey],
  )

  const openDetail = (sectionKey?: string, title?: string) => {
    setDetailSectionKey(sectionKey)
    setDetailTitle(title ?? "Datos del cálculo / Declaración")
    setDetailOpen(true)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setErrorMessage(null)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleGenerateEntry = async () => {
    setIsGenerating(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const data = await apiFetch<{ success: true; message: string; refNumber: number }>(
        `/api/fiscal/models/${modelParam}/${year}/${quarterParam}/generate-entry`,
        { method: "POST" },
      )
      setSuccessMessage(data.message)
      await onRefresh()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo generar el asiento.")
    } finally {
      setIsGenerating(false)
    }
  }

  if (!DRAFT_SUPPORTED_MODELS.has(detail.modelCode)) {
    return null
  }

  const tableLayout = getDraftTableLayout(detail.modelCode)

  return (
    <>
      <div className="rounded-lg border border-graphite-300 bg-[#f4f4f4] shadow-sm">
        <div className="border-b border-graphite-300 bg-[#dce6ef] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-graphite-700">
                Borrador fiscal · AEAT
              </p>
              <h1 className="text-lg font-bold text-graphite-900">{draft.modelLabel}</h1>
              <p className="text-sm text-graphite-600">Modelo {draft.modelCode} — {draft.periodLabel}</p>
            </div>
            <Badge variant="outline" className={cn("font-bold uppercase", statusBadgeClass(detail.status))}>
              {draft.statusLabel}
            </Badge>
          </div>
        </div>

        <div className="grid gap-0 border-b border-graphite-300 bg-white md:grid-cols-2">
          <div className="border-b border-graphite-200 p-4 md:border-b-0 md:border-r">
            <p className="text-[10px] font-bold uppercase tracking-wider text-graphite-500">Identificación</p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium text-graphite-600">N.I.F.</dt>
                <dd className="font-mono font-semibold text-graphite-900">{draft.nif}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium text-graphite-600">Razón social</dt>
                <dd className="font-semibold text-graphite-900">{draft.companyName}</dd>
              </div>
            </dl>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-graphite-500">Devengo</p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium text-graphite-600">Ejercicio</dt>
                <dd className="font-mono font-semibold">{draft.year}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium text-graphite-600">Período</dt>
                <dd className="font-mono font-semibold">{draft.periodLabel}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="space-y-0 bg-white pb-4">
          {draft.sections.map((section) => {
            if (tableLayout === "iva") {
              return <Model303SectionTable key={section.id} section={section} onOpenDetail={openDetail} />
            }
            if (tableLayout === "retenciones") {
              return <RetentionSectionTable key={section.id} section={section} onOpenDetail={openDetail} />
            }
            return <GenericSectionTable key={section.id} section={section} onOpenDetail={openDetail} />
          })}

          <div className="flex items-center justify-between border-t border-graphite-200 bg-[#dce6ef] px-4 py-3">
            <span className="text-sm font-bold uppercase text-graphite-800">
              {getResultCasillaLabel(detail.modelCode)}
            </span>
            <button
              type="button"
              className="font-mono text-lg font-bold tabular-nums text-graphite-900 hover:underline"
              onClick={() => openDetail(undefined, "Detalle completo del cálculo")}
            >
              {formatFiscalAmount(resultAmount)}
            </button>
          </div>
        </div>

        {(successMessage || errorMessage) && (
          <div
            className={cn(
              "border-t px-4 py-2 text-sm",
              successMessage
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800",
            )}
          >
            {successMessage ?? errorMessage}
          </div>
        )}

        <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-2 border-t border-graphite-300 bg-[#f8f8f8]/95 px-4 py-3 shadow-[0_-6px_18px_rgba(0,0,0,0.08)] backdrop-blur-sm">
          {draft.supportsGenerateEntry && (
            <Button
              type="button"
              size="sm"
              disabled={isGenerating || draft.hasExistingLiquidation}
              onClick={() => void handleGenerateEntry()}
              className="gap-2 bg-emerald-800 hover:bg-emerald-900"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}
              Generar asiento
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => openDetail(undefined, "Detalle cálculo / Declaración")}
          >
            <Calculator className="h-4 w-4" />
            Detalle cálculo / Declaración
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={isRefreshing}
            onClick={() => void handleRefresh()}
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </Button>
          <div className="ml-auto flex min-w-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
            <span className="hidden text-xs text-graphite-500 lg:inline">
              <FileText className="mr-1 inline h-3.5 w-3.5" />
              Listar / PDF / Exportar
            </span>
            <FiscalExportButtons
              model={modelParam}
              quarter={quarterParam}
              year={year}
              compact
            />
          </div>
        </div>
      </div>

      <FiscalCalculationDetailDialog
        open={detailOpen}
        title={detailTitle}
        rows={detailRows}
        nifColumnLabel={draft.modelCode === "349" ? "NIF-IVA UE" : "NIF"}
        onClose={() => setDetailOpen(false)}
        onOpenEntry={(entryId) => {
          setDetailOpen(false)
          setSelectedEntryId(entryId)
        }}
      />

      <EditAccountingEntryDialog
        open={selectedEntryId !== null}
        entryId={selectedEntryId}
        onClose={() => setSelectedEntryId(null)}
        onSaved={() => void onRefresh()}
      />
    </>
  )
}

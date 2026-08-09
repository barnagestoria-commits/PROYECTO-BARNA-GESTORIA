"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { FiscalExportButtons } from "@/components/report-export-buttons"
import { FiscalCalculationDetailDialog } from "@/components/fiscal/fiscal-calculation-detail-dialog"
import { EditAccountingEntryDialog } from "@/components/accounting/edit-accounting-entry-dialog"
import {
  AeatOfficialFormHeader,
  AeatOfficialIvaSection,
  AeatOfficialResultRow,
  AeatOfficialSingleAmountSection,
} from "@/components/fiscal/aeat-official-form"
import { buildFiscalModelDraft } from "@/lib/fiscal/model-draft/build-model-draft"
import { buildCalculationDetailRows } from "@/lib/fiscal/model-draft/calculation-rows"
import { DRAFT_SUPPORTED_MODELS } from "@/lib/fiscal/model-draft/types"
import {
  getDraftTableLayout,
  getResultCasillaLabel,
  resolveDraftResultAmount,
} from "@/lib/fiscal/official-layouts"
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
      return "border-emerald-700 bg-emerald-100 text-emerald-900"
    case "pendiente":
      return "border-red-700 bg-red-100 text-red-900"
    case "sin_datos":
      return "border-red-400 bg-red-50 text-red-800"
  }
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
      <div className="mx-auto max-w-5xl bg-[#e8e8e8] p-2 shadow-md md:p-4">
        <AeatOfficialFormHeader
          modelCode={draft.modelCode}
          modelLabel={draft.modelLabel}
          nif={draft.nif}
          companyName={draft.companyName}
          year={draft.year}
          periodLabel={draft.periodLabel}
          statusLabel={draft.statusLabel}
          statusClassName={statusBadgeClass(detail.status)}
        />

        <div className="mt-0">
          {draft.sections.map((section) =>
            tableLayout === "iva" ? (
              <AeatOfficialIvaSection key={section.id} section={section} onOpenDetail={openDetail} />
            ) : (
              <AeatOfficialSingleAmountSection key={section.id} section={section} onOpenDetail={openDetail} />
            ),
          )}

          <AeatOfficialResultRow
            label={getResultCasillaLabel(detail.modelCode)}
            amount={resultAmount}
            onOpenDetail={() => openDetail(undefined, "Detalle completo del cálculo")}
          />
        </div>

        {(successMessage || errorMessage) && (
          <div
            className={cn(
              "mt-2 border px-4 py-2 text-sm",
              successMessage
                ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                : "border-red-700 bg-red-50 text-red-900",
            )}
          >
            {successMessage ?? errorMessage}
          </div>
        )}

        <div className="sticky bottom-0 z-20 mt-2 flex flex-wrap items-center gap-2 border border-black bg-[#f0f0f0]/95 px-3 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.12)] backdrop-blur-sm">
          {draft.supportsGenerateEntry && (
            <Button
              type="button"
              size="sm"
              disabled={isGenerating || draft.hasExistingLiquidation}
              onClick={() => void handleGenerateEntry()}
              className="gap-2 bg-[#1a4480] hover:bg-[#153a6b]"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}
              Generar asiento
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2 border-black"
            onClick={() => openDetail(undefined, "Detalle cálculo / Declaración")}
          >
            <Calculator className="h-4 w-4" />
            Detalle cálculo / Declaración
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2 border-black"
            disabled={isRefreshing}
            onClick={() => void handleRefresh()}
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </Button>
          <div className="ml-auto flex min-w-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
            <span className="hidden text-xs text-neutral-600 lg:inline">
              <FileText className="mr-1 inline h-3.5 w-3.5" />
              Listar / PDF / Exportar
            </span>
            <FiscalExportButtons model={modelParam} quarter={quarterParam} year={year} compact />
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

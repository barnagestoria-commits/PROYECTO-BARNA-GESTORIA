"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { FiscalExportButtons } from "@/components/report-export-buttons"
import { FiscalCalculationDetailDialog } from "@/components/fiscal/fiscal-calculation-detail-dialog"
import { FiscalModelDraftPdfPreview } from "@/components/fiscal/fiscal-model-draft-pdf-preview"
import { EditAccountingEntryDialog } from "@/components/accounting/edit-accounting-entry-dialog"
import { buildFiscalModelDraft } from "@/lib/fiscal/model-draft/build-model-draft"
import { buildCalculationDetailRows } from "@/lib/fiscal/model-draft/calculation-rows"
import { DRAFT_SUPPORTED_MODELS } from "@/lib/fiscal/model-draft/types"
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

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTitle, setDetailTitle] = useState("Datos del cálculo")
  const [detailSectionKey, setDetailSectionKey] = useState<string | undefined>()
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pdfRefreshKey, setPdfRefreshKey] = useState(0)
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
      setPdfRefreshKey((value) => value + 1)
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
      setPdfRefreshKey((value) => value + 1)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo generar el asiento.")
    } finally {
      setIsGenerating(false)
    }
  }

  if (!DRAFT_SUPPORTED_MODELS.has(detail.modelCode)) {
    return null
  }

  return (
    <>
      <div className="mx-auto max-w-5xl overflow-hidden shadow-md">
        <FiscalModelDraftPdfPreview
          modelParam={modelParam}
          year={year}
          quarterParam={quarterParam}
          refreshKey={pdfRefreshKey}
        />

        {(successMessage || errorMessage) && (
          <div
            className={cn(
              "border-x border-b border-black px-4 py-2 text-sm",
              successMessage
                ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                : "border-red-700 bg-red-50 text-red-900",
            )}
          >
            {successMessage ?? errorMessage}
          </div>
        )}

        <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-2 border border-black bg-[#f0f0f0]/95 px-3 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.12)] backdrop-blur-sm">
          <p className="mr-2 hidden text-xs text-neutral-700 lg:block">
            Modelo {draft.modelCode} · {draft.nif} · {draft.periodLabel} {draft.year}
          </p>
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
            Detalle cálculo
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
            Actualizar borrador
          </Button>
          <div className="ml-auto flex min-w-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
            <span className="hidden text-xs text-neutral-600 lg:inline">
              <FileText className="mr-1 inline h-3.5 w-3.5" />
              Fichero telemático / exportación
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
        onSaved={() => void handleRefresh()}
      />
    </>
  )
}

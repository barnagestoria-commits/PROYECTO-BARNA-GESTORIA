"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  downloadFiscalExport,
  downloadReport,
  type FiscalExportFormat,
} from "@/lib/reports/download-client"
import type { GestoriaAccountDetailLevel } from "@/lib/contabilidad/gestoria-presentation-config"
import {
  FISCAL_EXPORT_DESCRIPTIONS,
  FISCAL_EXPORT_FORMATS,
  FISCAL_EXPORT_LABELS,
} from "@/lib/fiscal/export-formats"
import {
  REPORT_EXPORT_DESCRIPTIONS,
  REPORT_EXPORT_FORMATS,
  REPORT_EXPORT_LABELS,
  type ReportExportFormat,
} from "@/lib/reports/export-formats"
import type { ReportType } from "@/lib/reports/types"
import { Archive, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const FORMAT_ICONS = {
  pdf: Download,
  xlsx: FileSpreadsheet,
  csv: FileText,
  txt: FileText,
  zip: Archive,
} as const

const TOOLBAR_FORMAT_ORDER = ["xlsx", "csv", "pdf", "zip"] as const

interface ReportExportButtonsProps {
  reportType: ReportType
  year?: number
  costCenterId?: string
  detailLevel?: GestoriaAccountDetailLevel
  disabled?: boolean
  variant?: "default" | "toolbar-mobile" | "toolbar-desktop"
  className?: string
}

export function ReportExportButtons({
  reportType,
  year,
  costCenterId,
  detailLevel,
  disabled = false,
  variant = "default",
  className,
}: ReportExportButtonsProps) {
  const [downloading, setDownloading] = useState<ReportExportFormat | null>(null)
  const currentYear = year ?? new Date().getFullYear()

  const handleDownload = async (format: ReportExportFormat) => {
    setDownloading(format)
    try {
      await downloadReport(reportType, format, currentYear, { costCenterId, detailLevel })
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo descargar el informe.")
    } finally {
      setDownloading(null)
    }
  }

  return renderFormatButtons({
    formats: REPORT_EXPORT_FORMATS,
    labels: REPORT_EXPORT_LABELS,
    descriptions: REPORT_EXPORT_DESCRIPTIONS,
    downloading,
    disabled,
    variant,
    className,
    onDownload: handleDownload,
  })
}

interface FiscalExportButtonsProps {
  model: string
  quarter: string | number
  year?: number
  disabled?: boolean
  className?: string
  compact?: boolean
  /** En barras inferiores, el menú debe abrirse hacia arriba para no recortarse. */
  menuPlacement?: "top" | "bottom"
}

export function FiscalExportButtons({
  model,
  quarter,
  year,
  disabled = false,
  className,
  compact = false,
  menuPlacement = "bottom",
}: FiscalExportButtonsProps) {
  const [downloading, setDownloading] = useState<FiscalExportFormat | null>(null)
  const currentYear = year ?? new Date().getFullYear()

  const formats = useMemo(() => {
    const isAnnual = quarter === "annual" || quarter === "anual"
    if (model === "180" || model === "190" || model === "347" || model === "390") {
      return FISCAL_EXPORT_FORMATS.filter((format) => format !== "txt" || model === "180")
    }
    if (isAnnual) {
      return FISCAL_EXPORT_FORMATS.filter((format) => format !== "txt")
    }
    return FISCAL_EXPORT_FORMATS
  }, [model, quarter])
  const labels = useMemo(
    () => ({
      ...FISCAL_EXPORT_LABELS,
      txt: model === "303" ? "Fichero AEAT .303" : FISCAL_EXPORT_LABELS.txt,
    }),
    [model],
  )
  const descriptions = useMemo(
    () => ({
      ...FISCAL_EXPORT_DESCRIPTIONS,
      txt:
        model === "303"
          ? "Fichero DR303 validado para importar en la Sede Electrónica de la AEAT"
          : FISCAL_EXPORT_DESCRIPTIONS.txt,
    }),
    [model],
  )

  const handleDownload = async (format: FiscalExportFormat) => {
    setDownloading(format)
    try {
      await downloadFiscalExport(model, currentYear, quarter, format)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo descargar la exportación.")
    } finally {
      setDownloading(null)
    }
  }

  return renderFormatButtons({
    formats,
    labels,
    descriptions,
    downloading,
    disabled,
    variant: compact ? "toolbar-desktop" : "default",
    className,
    menuPlacement,
    highlightTxt: compact,
    onDownload: handleDownload,
  })
}

function orderToolbarFormats<T extends string>(formats: readonly T[]): T[] {
  const ordered = TOOLBAR_FORMAT_ORDER.filter((format) =>
    formats.includes(format as T),
  ) as T[]
  const remaining = formats.filter((format) => !TOOLBAR_FORMAT_ORDER.includes(format as typeof TOOLBAR_FORMAT_ORDER[number]))
  return [...ordered, ...remaining]
}

function ExportFormatDropdown<T extends string>({
  formats,
  labels,
  descriptions,
  downloading,
  disabled,
  variant,
  menuPlacement = "bottom",
  onDownload,
}: {
  formats: readonly T[]
  labels: Record<T, string>
  descriptions: Record<T, string>
  downloading: T | null
  disabled: boolean
  variant: "toolbar-mobile" | "toolbar-desktop"
  menuPlacement?: "top" | "bottom"
  onDownload: (format: T) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isMobile = variant === "toolbar-mobile"
  const orderedFormats = orderToolbarFormats(formats)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  const handleSelect = (format: T) => {
    setOpen(false)
    onDownload(format)
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        title="Exportar listado"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled || downloading !== null}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors disabled:opacity-50",
          isMobile
            ? "text-emerald-100 hover:bg-emerald-900/50"
            : "text-emerald-700 hover:bg-emerald-100",
        )}
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">Exportar</span>
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-[80] min-w-[11rem] overflow-hidden rounded-md border py-1 shadow-xl",
            menuPlacement === "top" ? "bottom-full mb-1" : "top-full mt-1",
            isMobile ? "border-emerald-800/60 bg-emerald-950" : "border-gray-200 bg-white",
          )}
        >
          {orderedFormats.map((format) => {
            const Icon = FORMAT_ICONS[format as keyof typeof FORMAT_ICONS] ?? Download
            const loading = downloading === format
            return (
              <button
                key={format}
                type="button"
                role="menuitem"
                disabled={disabled || loading}
                title={descriptions[format]}
                onClick={() => handleSelect(format)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors disabled:opacity-50",
                  isMobile
                    ? "text-emerald-50 hover:bg-emerald-900/70"
                    : "text-gray-800 hover:bg-emerald-50",
                )}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4 shrink-0" />
                )}
                <span>{labels[format]}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function renderFormatButtons<T extends string>({
  formats,
  labels,
  descriptions,
  downloading,
  disabled,
  variant,
  className,
  menuPlacement = "bottom",
  highlightTxt = false,
  onDownload,
}: {
  formats: readonly T[]
  labels: Record<T, string>
  descriptions: Record<T, string>
  downloading: T | null
  disabled: boolean
  variant: "default" | "toolbar-mobile" | "toolbar-desktop"
  className?: string
  menuPlacement?: "top" | "bottom"
  highlightTxt?: boolean
  onDownload: (format: T) => void
}) {
  if (variant === "toolbar-mobile" || variant === "toolbar-desktop") {
    const txtFormat = highlightTxt ? formats.find((format) => format === "txt") : undefined
    const menuFormats = txtFormat ? formats.filter((format) => format !== "txt") : formats

    return (
      <div className={cn("flex shrink-0 flex-wrap items-center gap-1", className)}>
        {txtFormat ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || downloading !== null}
            title={descriptions[txtFormat]}
            className="shrink-0 gap-2 border-emerald-700 bg-white text-emerald-800 hover:bg-emerald-50"
            onClick={() => onDownload(txtFormat)}
          >
            {downloading === txtFormat ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            TXT Hacienda
          </Button>
        ) : null}
        {menuFormats.length > 0 ? (
          <ExportFormatDropdown
            formats={menuFormats}
            labels={labels}
            descriptions={descriptions}
            downloading={downloading}
            disabled={disabled}
            variant={variant}
            menuPlacement={menuPlacement}
            onDownload={onDownload}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:flex sm:flex-wrap", className)}>
      {formats.map((format) => {
        const Icon = FORMAT_ICONS[format as keyof typeof FORMAT_ICONS] ?? Download
        const loading = downloading === format
        return (
          <Button
            key={format}
            variant="outline"
            size="sm"
            disabled={disabled || loading}
            className="gap-2 border-emerald-200 hover:bg-emerald-50"
            onClick={() => onDownload(format)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
            {labels[format]}
          </Button>
        )
      })}
    </div>
  )
}

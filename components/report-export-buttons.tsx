"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  downloadFiscalExport,
  downloadReport,
  type FiscalExportFormat,
} from "@/lib/reports/download-client"
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
  disabled?: boolean
  variant?: "default" | "toolbar-mobile" | "toolbar-desktop"
  className?: string
}

export function ReportExportButtons({
  reportType,
  year,
  disabled = false,
  variant = "default",
  className,
}: ReportExportButtonsProps) {
  const [downloading, setDownloading] = useState<ReportExportFormat | null>(null)
  const currentYear = year ?? new Date().getFullYear()

  const handleDownload = async (format: ReportExportFormat) => {
    setDownloading(format)
    try {
      await downloadReport(reportType, format, currentYear)
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
}

export function FiscalExportButtons({
  model,
  quarter,
  year,
  disabled = false,
  className,
  compact = false,
}: FiscalExportButtonsProps) {
  const [downloading, setDownloading] = useState<FiscalExportFormat | null>(null)
  const currentYear = year ?? new Date().getFullYear()

  const formats = useMemo(() => {
    const isAnnual = quarter === "annual" || quarter === "anual"
    if (model === "180") {
      return FISCAL_EXPORT_FORMATS.filter((format) => format !== "txt" || isAnnual)
    }
    if (isAnnual) {
      return FISCAL_EXPORT_FORMATS.filter((format) => format !== "txt")
    }
    return FISCAL_EXPORT_FORMATS
  }, [model, quarter])

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
    labels: FISCAL_EXPORT_LABELS,
    descriptions: FISCAL_EXPORT_DESCRIPTIONS,
    downloading,
    disabled,
    variant: compact ? "toolbar-desktop" : "default",
    className,
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
  onDownload,
}: {
  formats: readonly T[]
  labels: Record<T, string>
  descriptions: Record<T, string>
  downloading: T | null
  disabled: boolean
  variant: "toolbar-mobile" | "toolbar-desktop"
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
            "absolute right-0 top-full z-50 mt-1 min-w-[9.5rem] overflow-hidden rounded-md border py-1 shadow-xl",
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
  onDownload,
}: {
  formats: readonly T[]
  labels: Record<T, string>
  descriptions: Record<T, string>
  downloading: T | null
  disabled: boolean
  variant: "default" | "toolbar-mobile" | "toolbar-desktop"
  className?: string
  onDownload: (format: T) => void
}) {
  if (variant === "toolbar-mobile" || variant === "toolbar-desktop") {
    return (
      <ExportFormatDropdown
        formats={formats}
        labels={labels}
        descriptions={descriptions}
        downloading={downloading}
        disabled={disabled}
        variant={variant}
        onDownload={onDownload}
      />
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

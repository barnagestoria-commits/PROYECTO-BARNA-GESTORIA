"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InvoiceCameraCapture } from "@/components/invoice-camera-capture"
import { apiFormFetch } from "@/lib/api-client"
import { isOcrMediaFile, isSpreadsheetFile } from "@/lib/documents/upload-file-type"
import { cn } from "@/lib/utils"
import {
  Camera,
  CreditCard,
  FileSpreadsheet,
  FileText,
  ImageUp,
  Loader2,
  Receipt,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type UploadDocumentType = "factura-recibida" | "factura-emitida" | "extracto-bancario"

export interface AccountingImportResult {
  rowsImported: number
  entriesCreated: number
  fileName: string
  format: string
}

interface FileUploadProps {
  onFilesSelected: (files: File[], type: UploadDocumentType) => void
  onAccountingImport?: (result: AccountingImportResult) => void
  onImportError?: (message: string) => void
  disabled?: boolean
  cameraTourId?: string
  initialDocumentType?: UploadDocumentType
  /** Si se indica, oculta el selector de tipo y fija el flujo a un solo documento */
  fixedDocumentType?: UploadDocumentType
}

interface DocumentTypeConfig {
  id: UploadDocumentType
  label: string
  shortLabel: string
  description: string
  icon: LucideIcon
  accent: string
  selectedRing: string
  supportsCamera: boolean
  mediaAccept: string
  mediaHint: string
}

const DOCUMENT_TYPES: DocumentTypeConfig[] = [
  {
    id: "factura-recibida",
    label: "Facturas Recibidas",
    shortLabel: "Recibidas",
    description: "Gastos y compras con OCR automático de proveedor, CIF e importes.",
    icon: Receipt,
    accent: "text-emerald-700",
    selectedRing: "ring-emerald-500 border-emerald-300 bg-emerald-50/80",
    supportsCamera: true,
    mediaAccept: ".pdf,.jpg,.jpeg,.png",
    mediaHint: "PDF, JPG o PNG",
  },
  {
    id: "factura-emitida",
    label: "Facturas Emitidas",
    shortLabel: "Emitidas",
    description: "Ventas y facturas que emite tu empresa hacia clientes, con OCR de cliente e importes.",
    icon: FileText,
    accent: "text-blue-700",
    selectedRing: "ring-blue-500 border-blue-300 bg-blue-50/80",
    supportsCamera: true,
    mediaAccept: ".pdf,.jpg,.jpeg,.png",
    mediaHint: "PDF, JPG o PNG",
  },
  {
    id: "extracto-bancario",
    label: "Extractos Bancarios",
    shortLabel: "Extractos",
    description: "Movimientos bancarios y conciliación de tesorería.",
    icon: CreditCard,
    accent: "text-amber-700",
    selectedRing: "ring-amber-500 border-amber-300 bg-amber-50/80",
    supportsCamera: false,
    mediaAccept: ".pdf,.jpg,.jpeg,.png",
    mediaHint: "PDF, JPG o PNG",
  },
]

const SPREADSHEET_ACCEPT = ".csv,.xlsx,.xls,.txt"

export { isOcrMediaFile, isSpreadsheetFile } from "@/lib/documents/upload-file-type"

export function FileUpload({
  onFilesSelected,
  onAccountingImport,
  onImportError,
  disabled = false,
  cameraTourId,
  initialDocumentType = "factura-recibida",
  fixedDocumentType,
}: FileUploadProps) {
  const [selectedType, setSelectedType] = useState<UploadDocumentType>(
    fixedDocumentType ?? initialDocumentType,
  )
  const [cameraOpen, setCameraOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [canPortal, setCanPortal] = useState(false)

  useEffect(() => {
    setSelectedType(fixedDocumentType ?? initialDocumentType)
  }, [fixedDocumentType, initialDocumentType])

  const mediaInputRef = useRef<HTMLInputElement>(null)
  const spreadsheetInputRef = useRef<HTMLInputElement>(null)

  const activeConfig = DOCUMENT_TYPES.find((type) => type.id === selectedType) ?? DOCUMENT_TYPES[0]

  const handleMediaFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0 || disabled) return
      onFilesSelected(Array.from(fileList), selectedType)
      if (mediaInputRef.current) mediaInputRef.current.value = ""
    },
    [disabled, onFilesSelected, selectedType],
  )

  const handleCameraCapture = useCallback(
    (file: File) => {
      onFilesSelected([file], selectedType)
    },
    [onFilesSelected, selectedType],
  )

  const handleSpreadsheetImport = useCallback(
    async (file: File | undefined) => {
      if (!file || disabled || isImporting) return

      setIsImporting(true)

      try {
        const formData = new FormData()
        formData.append("file", file)
        const data = await apiFormFetch<{
          success: true
          import: AccountingImportResult
        }>("/api/imports/accounting", formData)

        onAccountingImport?.(data.import)
      } catch (error) {
        onImportError?.(error instanceof Error ? error.message : "Error al importar el archivo.")
      } finally {
        setIsImporting(false)
        if (spreadsheetInputRef.current) spreadsheetInputRef.current.value = ""
      }
    },
    [disabled, isImporting, onAccountingImport, onImportError],
  )

  const receiveDroppedFiles = useCallback(
    (files: File[]) => {
      if (disabled || files.length === 0) return

      const media = files.filter(isOcrMediaFile)
      const spreadsheet = files.find(isSpreadsheetFile)

      if (media.length > 0) {
        onFilesSelected(media, selectedType)
      }
      if (spreadsheet) {
        void handleSpreadsheetImport(spreadsheet)
      }
    },
    [disabled, handleSpreadsheetImport, onFilesSelected, selectedType],
  )

  useEffect(() => {
    setCanPortal(true)
  }, [])

  useEffect(() => {
    if (disabled || cameraOpen) {
      setIsDragActive(false)
      return
    }

    let depth = 0
    const hasFiles = (event: DragEvent) => Boolean(event.dataTransfer?.types?.includes("Files"))

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth += 1
      setIsDragActive(true)
    }
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"
    }
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setIsDragActive(false)
    }
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setIsDragActive(false)
      receiveDroppedFiles(Array.from(event.dataTransfer?.files ?? []))
    }

    window.addEventListener("dragenter", onDragEnter)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onDragEnter)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("drop", onDrop)
    }
  }, [cameraOpen, disabled, receiveDroppedFiles])

  return (
    <div className="relative min-w-0 space-y-6">
      {canPortal && isDragActive
        ? createPortal(
            <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-emerald-950/40 p-6">
              <div className="max-w-md rounded-2xl border-2 border-dashed border-white bg-white px-6 py-8 text-center shadow-2xl">
                <ImageUp className="mx-auto h-10 w-10 text-emerald-700" />
                <p className="mt-3 text-lg font-semibold text-pine-900">Suelta el archivo aquí</p>
                <p className="mt-1 text-sm text-graphite-600">
                  PDF o imagen para OCR · Excel/CSV para importar asientos
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
      {!fixedDocumentType && (
        <div>
          <p className="mb-3 text-sm font-medium text-gray-700">1. ¿Qué vas a subir?</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {DOCUMENT_TYPES.map((type) => {
              const Icon = type.icon
              const isSelected = selectedType === type.id

              return (
                <button
                  key={type.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedType(type.id)}
                  className={cn(
                    "rounded-xl border p-3 sm:p-4 text-left transition-all",
                    "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500/40",
                    isSelected ? `ring-2 ${type.selectedRing}` : "border-gray-200 bg-white hover:border-gray-300",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm",
                        type.accent,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 break-words">{type.shortLabel}</p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500 break-words text-pretty">
                        {type.description}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <Card
        className={cn(
          "border-emerald-200/80 shadow-sm",
          isDragActive && "ring-2 ring-emerald-500",
        )}
      >
        <CardHeader className="pb-3 px-4 sm:px-6">
          <CardTitle className="flex items-start gap-2 text-base sm:text-lg text-emerald-900 leading-snug">
            <activeConfig.icon className={cn("mt-0.5 h-5 w-5 shrink-0", activeConfig.accent)} />
            <span className="min-w-0 break-words text-balance">{activeConfig.label}</span>
          </CardTitle>
          <CardDescription className="break-words text-pretty leading-relaxed">
            {fixedDocumentType
              ? "Elige cómo quieres aportar la documentación o los movimientos contables."
              : "2. Elige cómo quieres aportar la documentación o los movimientos contables."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4 sm:px-6 pb-4 sm:pb-6">
          {activeConfig.supportsCamera && (
            <Button
              type="button"
              size="lg"
              disabled={disabled}
              data-tour={selectedType === "factura-recibida" ? cameraTourId : undefined}
              onClick={() => setCameraOpen(true)}
              className="h-auto w-full min-w-0 justify-start gap-3 sm:gap-4 rounded-xl bg-emerald-800 px-4 py-3 sm:px-5 sm:py-4 text-left hover:bg-emerald-700 whitespace-normal"
            >
              <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Camera className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm sm:text-base font-semibold break-words">Tomar foto con cámara</span>
                <span className="block text-xs font-normal text-emerald-100/90 break-words text-pretty leading-relaxed">
                  Encuadra la factura con la guía verde y captura al instante
                </span>
              </span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={disabled}
            onClick={() => mediaInputRef.current?.click()}
            className="h-auto w-full min-w-0 justify-start gap-3 sm:gap-4 rounded-xl border-2 px-4 py-3 sm:px-5 sm:py-4 text-left hover:bg-gray-50 whitespace-normal"
          >
            <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <ImageUp className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm sm:text-base font-semibold text-gray-900 break-words">
                Subir PDF o imagen
              </span>
              <span className="block text-xs font-normal text-gray-500 break-words text-pretty leading-relaxed">
                {activeConfig.mediaHint}
                {selectedType === "factura-recibida" || selectedType === "factura-emitida"
                  ? " · OCR automático"
                  : ""}
                <span className="hidden md:inline"> · o arrástralo a esta ventana</span>
              </span>
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={disabled || isImporting}
            onClick={() => spreadsheetInputRef.current?.click()}
            className="h-auto w-full min-w-0 justify-start gap-3 sm:gap-4 rounded-xl border-2 border-dashed border-emerald-300 px-4 py-3 sm:px-5 sm:py-4 text-left hover:bg-emerald-50/50 whitespace-normal"
          >
            <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              {isImporting ? (
                <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6" />
              )}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm sm:text-base font-semibold text-gray-900 break-words">
                Importar Excel / CSV
              </span>
              <span className="block text-xs font-normal text-gray-500 break-words text-pretty leading-relaxed">
                Contabilidad externa · columnas: fecha, cuenta, concepto, debe, haber
              </span>
            </span>
          </Button>

          <input
            ref={mediaInputRef}
            type="file"
            className="hidden"
            accept={activeConfig.mediaAccept}
            multiple
            onChange={(event) => handleMediaFiles(event.target.files)}
          />
          <input
            ref={spreadsheetInputRef}
            type="file"
            className="hidden"
            accept={SPREADSHEET_ACCEPT}
            onChange={(event) => void handleSpreadsheetImport(event.target.files?.[0])}
          />
        </CardContent>
      </Card>

      <InvoiceCameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  )
}

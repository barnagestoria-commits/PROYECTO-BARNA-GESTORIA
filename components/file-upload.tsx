"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InvoiceCameraCapture } from "@/components/invoice-camera-capture"
import { apiFormFetch } from "@/lib/api-client"
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
    description: "Ventas y facturas que emite tu empresa hacia clientes.",
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

export function FileUpload({
  onFilesSelected,
  onAccountingImport,
  onImportError,
  disabled = false,
  cameraTourId,
  initialDocumentType = "factura-recibida",
}: FileUploadProps) {
  const [selectedType, setSelectedType] = useState<UploadDocumentType>(initialDocumentType)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    setSelectedType(initialDocumentType)
  }, [initialDocumentType])

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
    async (fileList: FileList | null) => {
      if (!fileList?.[0] || disabled || isImporting) return

      const file = fileList[0]
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

  return (
    <div className="space-y-6 overflow-x-hidden">
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

      <Card className="border-emerald-200/80 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 px-4 sm:px-6">
          <CardTitle className="flex items-start gap-2 text-base sm:text-lg text-emerald-900 leading-snug">
            <activeConfig.icon className={cn("mt-0.5 h-5 w-5 shrink-0", activeConfig.accent)} />
            <span className="min-w-0 break-words text-balance">{activeConfig.label}</span>
          </CardTitle>
          <CardDescription className="break-words text-pretty leading-relaxed">
            2. Elige cómo quieres aportar la documentación o los movimientos contables.
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
                {selectedType === "factura-recibida" ? " · OCR automático" : ""}
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
            onChange={(event) => handleSpreadsheetImport(event.target.files)}
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

"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { apiFormFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface PortfolioCandidatePreview {
  clientCode: string
  name: string
  cif: string | null
  entityType: "juridica" | "fisica"
  source: string
  status: "new" | "exists" | "skipped"
  existingCompanyName?: string
  skipReason?: string
  entryCount?: number | null
  hasAccountingData?: boolean
}

interface PortfolioPreview {
  fileName: string
  sourceType: string
  newCount: number
  existingCount: number
  skippedCount: number
  accountingEntryCount: number
  newWithAccountingCount: number
  warnings: string[]
  candidates: PortfolioCandidatePreview[]
}

export function PortfolioImportPanel() {
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PortfolioPreview | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setPendingFile(null)
    setPreview(null)
  }

  const handlePreview = async (file: File) => {
    setIsPreviewing(true)
    setError(null)
    setMessage(null)
    setPreview(null)
    setPendingFile(file)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const data = await apiFormFetch<{ success: true; preview: PortfolioPreview }>(
        "/api/imports/portfolio/preview",
        formData,
      )

      setPreview(data.preview)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al analizar el fichero.")
      setPendingFile(null)
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleConfirm = async () => {
    if (!pendingFile || isConfirming) return

    setIsConfirming(true)
    setError(null)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append("file", pendingFile)

      const data = await apiFormFetch<{
        success: true
        import: {
          created: number
          alreadyExists: number
          skipped: number
          fileName: string
          accountingImported: number
          accountingFailed: number
          totalEntriesCreated: number
        }
      }>("/api/imports/portfolio/confirm", formData)

      let resultMessage = `Cartera importada: ${data.import.created} empresas nuevas dadas de alta`
      if (data.import.alreadyExists > 0) {
        resultMessage += `, ${data.import.alreadyExists} ya existían`
      }
      if (data.import.skipped > 0) {
        resultMessage += `, ${data.import.skipped} omitidas`
      }
      if (data.import.totalEntriesCreated > 0) {
        resultMessage += `. Contabilidad volcada: ${data.import.totalEntriesCreated} asientos en ${data.import.accountingImported} empresa(s)`
      }
      if (data.import.accountingFailed > 0) {
        resultMessage += `. ${data.import.accountingFailed} empresa(s) con error en la importación contable`
      }
      resultMessage += "."

      setMessage(resultMessage)
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al confirmar la importación.")
    } finally {
      setIsConfirming(false)
    }
  }

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0]
      if (!file || isPreviewing || isConfirming) return
      void handlePreview(file)
    },
    // handlePreview uses setters; busy flags prevent re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isConfirming, isPreviewing],
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    noClick: true,
    disabled: isPreviewing || isConfirming,
    // Validamos por extensión: en macOS el MIME al arrastrar a veces no es fiable.
    accept: undefined,
    validator: (file) => {
      const name = file.name.toLowerCase()
      const ok = [".zip", ".csv", ".txt", ".xlsx", ".xls"].some((ext) => name.endsWith(ext))
      if (!ok) {
        return {
          code: "invalid-extension",
          message: "Formato no válido",
        }
      }
      return null
    },
    onDropRejected: () => {
      setError("Formato no válido. Usa ZIP, CSV, TXT, XLSX o XLS.")
    },
  })

  return (
    <div className="space-y-4">
      {message && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!preview && (
        <div
          {...getRootProps()}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors",
            isPreviewing
              ? "border-emerald-300 bg-emerald-50/40"
              : isDragActive
                ? "border-emerald-500 bg-emerald-50"
                : "border-sand-300 bg-sand-50/40 hover:border-emerald-300",
          )}
        >
          <input {...getInputProps({ accept: ".zip,.csv,.txt,.xlsx,.xls" })} />
          {isPreviewing ? (
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-700" />
          ) : (
            <Users className="mb-3 h-8 w-8 text-emerald-700" />
          )}
          <p className="text-sm font-medium text-pine-900">
            {isPreviewing
              ? "Analizando fichero de cartera..."
              : isDragActive
                ? "Suelta el fichero aquí"
                : "Migrar cartera de clientes / empresas"}
          </p>
          <p className="mt-1 max-w-md text-xs text-graphite-500">
            Arrastra el fichero aquí o haz clic en el botón para seleccionarlo
          </p>
          <p className="mt-1 max-w-md text-xs text-graphite-500">
            ZIP con carpetas E00xxx (alta + contabilidad automática), CSV
            o Excel con columnas <strong>nombre</strong> y <strong>NIF</strong>
          </p>
          <Button
            type="button"
            className="mt-4 bg-emerald-800 hover:bg-pine-900"
            disabled={isPreviewing}
            onClick={(event) => {
              event.stopPropagation()
              open()
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Seleccionar fichero
          </Button>
        </div>
      )}

      {preview && (
        <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div>
            <p className="text-sm font-semibold text-pine-900">
              Se van a dar de alta {preview.newCount} empresas en la cartera de la gestoría
            </p>
            <p className="mt-1 text-xs text-graphite-600">
              {preview.candidates.length} empresas detectadas · {preview.existingCount} ya existen
              {preview.skippedCount > 0 ? ` · ${preview.skippedCount} omitidas` : ""}
              {preview.newWithAccountingCount > 0
                ? ` · ${preview.newWithAccountingCount} con contabilidad (${preview.accountingEntryCount} asientos)`
                : ""}
            </p>
          </div>

          {preview.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              {warning}
            </p>
          ))}

          <ul className="max-h-64 divide-y divide-sand-200 overflow-y-auto rounded-lg border border-sand-200 bg-white">
            {preview.candidates.map((candidate) => (
              <li
                key={`${candidate.clientCode}-${candidate.name}`}
                className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-graphite-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-pine-900">{candidate.name}</p>
                  <p className="text-xs text-graphite-500">
                    Cód. {candidate.clientCode}
                    {candidate.cif ? ` · ${candidate.cif}` : " · Sin NIF"}
                    {candidate.status === "new" && (candidate.entryCount ?? 0) > 0
                      ? ` · ${candidate.entryCount} asientos`
                      : candidate.status === "new" && candidate.hasAccountingData === false
                        ? " · Sin contabilidad detectada"
                        : ""}
                  </p>
                </div>
                <PortfolioStatusBadge candidate={candidate} />
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-emerald-800 hover:bg-pine-900"
              disabled={isConfirming || preview.newCount === 0}
              onClick={() => void handleConfirm()}
            >
              {isConfirming ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Confirmar alta
              {preview.newWithAccountingCount > 0
                ? ` e importar ${preview.accountingEntryCount} asientos`
                : ` de ${preview.newCount} empresas`}
            </Button>
            <Button type="button" variant="outline" disabled={isConfirming} onClick={reset}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function PortfolioStatusBadge({ candidate }: { candidate: PortfolioCandidatePreview }) {
  if (candidate.status === "new") {
    return (
      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
        Nueva
      </Badge>
    )
  }
  if (candidate.status === "exists") {
    return (
      <Badge className="border-sand-300 bg-sand-50 text-graphite-700 hover:bg-sand-50">
        Ya existe
      </Badge>
    )
  }
  return (
    <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
      Omitida
    </Badge>
  )
}

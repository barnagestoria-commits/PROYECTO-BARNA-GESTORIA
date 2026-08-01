"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch, apiFormFetch } from "@/lib/api-client"
import {
  A3_DIRECT_UPLOAD_MAX_BYTES,
  chunkA3Entries,
  extractVendorRefsFromEntries,
  shouldUseClientSideA3Import,
} from "@/lib/imports/a3/a3-client-import"
import { parseA3ZipBytes } from "@/lib/imports/a3/parse-a3-zip"
import type { A3ImportPreview, A3JournalEntry } from "@/lib/imports/a3/types"
import { cn } from "@/lib/utils"

export interface A3ZipPreview {
  versionLabel: string
  companyCode: string | null
  fiscalYear: number | null
  entryCount: number
  subaccountCount: number
  newSubaccountCount: number
  thirdPartyCount: number
  newThirdPartyCount: number
  recordTypes: string[]
  contents: {
    fileNames: string[]
    subaccountSource: string | null
    journalSource: string | null
    linkFormat: string
    importMode?: "native-export" | "suenlace-matrix" | "ascii-text"
  }
  warnings: string[]
}

function describeImportMode(mode?: A3ZipPreview["contents"]["importMode"]): string {
  if (mode === "native-export") {
    return "Exportación nativa Wolters Kluwer (menú Exportar, carpeta E00xxx)"
  }
  if (mode === "suenlace-matrix") {
    return "Enlace contable SUENLACE (Matrix Form / carpetas DAT)"
  }
  return "Texto / CSV"
}

interface ParsedA3State {
  fileName: string
  entries: A3JournalEntry[]
  meta: Omit<A3ImportPreview, "newSubaccountCount" | "newThirdPartyCount" | "entries">
}

interface A3CompanyImportPanelProps {
  companyId: string
  companyName: string
  compact?: boolean
  onSuccess?: (message: string) => void
}

export function A3CompanyImportPanel({
  companyId,
  companyName,
  compact = false,
  onSuccess,
}: A3CompanyImportPanelProps) {
  const [pendingZipFile, setPendingZipFile] = useState<File | null>(null)
  const [parsedState, setParsedState] = useState<ParsedA3State | null>(null)
  const [a3Preview, setA3Preview] = useState<A3ZipPreview | null>(null)
  const [isPreviewingZip, setIsPreviewingZip] = useState(false)
  const [isConfirmingZip, setIsConfirmingZip] = useState(false)
  const [confirmProgress, setConfirmProgress] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const resetZipImport = () => {
    setPendingZipFile(null)
    setParsedState(null)
    setA3Preview(null)
    setConfirmProgress(null)
  }

  const buildPreviewFromParsed = (
    parsed: Omit<A3ImportPreview, "newSubaccountCount" | "newThirdPartyCount">,
    counts: { newSubaccountCount: number; newThirdPartyCount: number },
  ): A3ZipPreview => ({
    versionLabel: parsed.versionLabel,
    companyCode: parsed.companyCode,
    fiscalYear: parsed.fiscalYear,
    entryCount: parsed.entryCount,
    subaccountCount: parsed.subaccountCount,
    newSubaccountCount: counts.newSubaccountCount,
    thirdPartyCount: parsed.thirdPartyCount,
    newThirdPartyCount: counts.newThirdPartyCount,
    recordTypes: parsed.recordTypes,
    contents: parsed.contents,
    warnings: parsed.warnings,
  })

  const previewViaServerUpload = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("companyId", companyId)

    const data = await apiFormFetch<{ success: true; preview: A3ZipPreview }>(
      "/api/imports/a3/preview",
      formData,
    )

    setA3Preview(data.preview)
  }

  const previewViaClientParse = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer()
    const parsed = await parseA3ZipBytes(arrayBuffer, file.name)
    const vendorRefs = extractVendorRefsFromEntries(parsed.entries)

    const { counts } = await apiFetch<{ success: true; counts: { newSubaccountCount: number; newThirdPartyCount: number } }>(
      "/api/imports/a3/preview-counts",
      {
        method: "POST",
        body: JSON.stringify({
          companyId,
          subaccounts: parsed.subaccounts,
          thirdParties: parsed.thirdParties,
          vendorRefs,
        }),
      },
    )

    const { entries, ...meta } = parsed
    setParsedState({ fileName: file.name, entries, meta })
    setA3Preview(buildPreviewFromParsed(parsed, counts))
  }

  const handleZipPreview = async (file: File) => {
    setIsPreviewingZip(true)
    setImportError(null)
    setImportMessage(null)
    setA3Preview(null)
    setParsedState(null)
    setPendingZipFile(file)

    try {
      if (shouldUseClientSideA3Import(file)) {
        await previewViaClientParse(file)
      } else {
        await previewViaServerUpload(file)
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Error al leer el archivo ZIP.")
      setPendingZipFile(null)
    } finally {
      setIsPreviewingZip(false)
    }
  }

  const confirmViaServerUpload = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("companyId", companyId)

    return apiFormFetch<{
      success: true
      import: {
        entriesCreated: number
        subaccountsCreated: number
        thirdPartiesCreated: number
        linesImported: number
        fileName: string
      }
    }>("/api/imports/a3/confirm", formData)
  }

  const confirmViaClientParse = async (state: ParsedA3State) => {
    const vendorRefs = extractVendorRefsFromEntries(state.entries)
    const { entries, ...meta } = state

    const start = await apiFetch<{
      success: true
      importId: string
      subaccountsCreated: number
      thirdPartiesCreated: number
    }>("/api/imports/a3/confirm-parsed/start", {
      method: "POST",
      body: JSON.stringify({
        companyId,
        fileName: state.fileName,
        meta,
        vendorRefs,
      }),
    })

    const batches = chunkA3Entries(entries)
    let entriesCreated = 0
    let linesImported = 0

    for (let index = 0; index < batches.length; index += 1) {
      setConfirmProgress(
        batches.length > 1
          ? `Importando asientos (${index + 1}/${batches.length})...`
          : "Importando asientos...",
      )

      const { batch } = await apiFetch<{
        success: true
        batch: { entriesCreated: number; linesImported: number }
      }>("/api/imports/a3/confirm-parsed/batch", {
        method: "POST",
        body: JSON.stringify({
          companyId,
          importId: start.importId,
          entries: batches[index],
        }),
      })

      entriesCreated += batch.entriesCreated
      linesImported += batch.linesImported
    }

    setConfirmProgress("Finalizando importación...")

    return apiFetch<{
      success: true
      import: {
        entriesCreated: number
        subaccountsCreated: number
        thirdPartiesCreated: number
        linesImported: number
        fileName: string
      }
    }>("/api/imports/a3/confirm-parsed/finish", {
      method: "POST",
      body: JSON.stringify({
        companyId,
        importId: start.importId,
        totals: {
          entriesCreated,
          subaccountsCreated: start.subaccountsCreated,
          thirdPartiesCreated: start.thirdPartiesCreated,
          linesImported,
        },
      }),
    })
  }

  const handleZipConfirm = async () => {
    if (isConfirmingZip) return
    if (!parsedState && !pendingZipFile) return

    setIsConfirmingZip(true)
    setImportError(null)
    setImportMessage(null)
    setConfirmProgress(null)

    try {
      const data = parsedState
        ? await confirmViaClientParse(parsedState)
        : pendingZipFile
          ? await confirmViaServerUpload(pendingZipFile)
          : null

      if (!data) return

      const message = `Importación completada en ${companyName}: ${data.import.entriesCreated} asientos, ${data.import.subaccountsCreated} subcuentas y ${data.import.thirdPartiesCreated} terceros nuevos (${data.import.linesImported} líneas).`
      setImportMessage(message)
      resetZipImport()
      onSuccess?.(message)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Error al confirmar la importación.")
    } finally {
      setIsConfirmingZip(false)
      setConfirmProgress(null)
    }
  }

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0]
      if (!file || isPreviewingZip || isConfirmingZip) return

      if (!file.name.toLowerCase().endsWith(".zip")) {
        setImportError("Selecciona un archivo .zip exportado desde Wolters Kluwer Asesor.")
        return
      }

      void handleZipPreview(file)
    },
    // handleZipPreview uses current companyId/state via closure; busy flags prevent re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyId, isConfirmingZip, isPreviewingZip],
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    noClick: true,
    disabled: isPreviewingZip || isConfirmingZip,
    // Validamos la extensión en onDrop: en macOS el MIME del ZIP a veces no es fiable.
    accept: undefined,
    validator: (file) => {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        return {
          code: "invalid-extension",
          message: "Solo se admiten archivos .zip",
        }
      }
      return null
    },
    onDropRejected: () => {
      setImportError("Selecciona un archivo .zip exportado desde Wolters Kluwer Asesor.")
    },
  })

  const usesClientParse = pendingZipFile ? shouldUseClientSideA3Import(pendingZipFile) : Boolean(parsedState)

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {importMessage && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {importMessage}
        </p>
      )}
      {importError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {importError}
        </p>
      )}

      {!a3Preview && (
        <div
          {...getRootProps()}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center transition-colors",
            compact ? "py-6" : "py-10",
            isPreviewingZip
              ? "border-emerald-300 bg-emerald-50/40"
              : isDragActive
                ? "border-emerald-500 bg-emerald-50"
                : "border-sand-300 bg-sand-50/40 hover:border-emerald-300",
          )}
        >
          <input {...getInputProps({ accept: ".zip" })} />
          {isPreviewingZip ? (
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-700" />
          ) : (
            <Upload className="mb-3 h-8 w-8 text-emerald-700" />
          )}
          <p className="text-sm font-medium text-pine-900">
            {isPreviewingZip
              ? "Analizando paquete ZIP..."
              : isDragActive
                ? "Suelta el archivo ZIP aquí"
                : "Importar contabilidad de Wolters Kluwer"}
          </p>
          <p className="mt-1 text-xs text-graphite-500">
            Arrastra un ZIP aquí o haz clic en el botón para seleccionarlo
          </p>
          <p className="mt-1 text-xs text-graphite-500">
            ZIP con DIARIO.TXT, SUBCUENT.TXT o exportación nativa (carpeta E00xxx)
          </p>
          <p className="mt-1 text-xs text-graphite-500">
            Archivos grandes se analizan en tu navegador (sin subir el ZIP completo)
          </p>
          <p className="mt-2 text-xs font-medium text-emerald-800">
            Destino: {companyName}
          </p>
          <Button
            type="button"
            className="mt-4 bg-emerald-800 hover:bg-pine-900"
            disabled={isPreviewingZip}
            onClick={(event) => {
              event.stopPropagation()
              open()
            }}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Seleccionar archivo ZIP
          </Button>
        </div>
      )}

      {a3Preview && (
        <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div>
            <p className="text-sm font-semibold text-pine-900">
              Se van a importar {a3Preview.entryCount} asientos en la contabilidad de {companyName}
            </p>
            <p className="mt-1 text-xs text-graphite-600">
              {a3Preview.subaccountCount} subcuentas detectadas ·{" "}
              {describeImportMode(a3Preview.contents.importMode)}
              {a3Preview.thirdPartyCount > 0 &&
                ` · ${a3Preview.thirdPartyCount} proveedores/clientes`}
            </p>
            {usesClientParse && (
              <p className="mt-1 text-xs text-emerald-700">
                Análisis local completado
                {pendingZipFile && pendingZipFile.size > A3_DIRECT_UPLOAD_MAX_BYTES
                  ? ` (${(pendingZipFile.size / (1024 * 1024)).toFixed(1)} MB — sin subir el ZIP a Vercel)`
                  : null}
              </p>
            )}
            {(a3Preview.newSubaccountCount > 0 || a3Preview.newThirdPartyCount > 0) && (
              <p className="mt-1 text-xs text-graphite-600">
                {a3Preview.newSubaccountCount > 0
                  ? `${a3Preview.newSubaccountCount} subcuentas nuevas`
                  : null}
                {a3Preview.newSubaccountCount > 0 && a3Preview.newThirdPartyCount > 0 ? " y " : null}
                {a3Preview.newThirdPartyCount > 0
                  ? `${a3Preview.newThirdPartyCount} terceros nuevos`
                  : null}
                {" se darán de alta antes de volcar el diario."}
              </p>
            )}
          </div>

          <dl className="grid gap-2 text-xs text-graphite-600 sm:grid-cols-2">
            {a3Preview.companyCode && (
              <div>
                <dt className="font-medium text-graphite-700">Código empresa (origen)</dt>
                <dd>{a3Preview.companyCode}</dd>
              </div>
            )}
            {a3Preview.fiscalYear && (
              <div>
                <dt className="font-medium text-graphite-700">Ejercicio contable</dt>
                <dd>{a3Preview.fiscalYear}</dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="font-medium text-graphite-700">Ficheros en el ZIP</dt>
              <dd className="break-all">{a3Preview.contents.fileNames.join(", ")}</dd>
            </div>
          </dl>

          {a3Preview.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              {warning}
            </p>
          ))}

          {confirmProgress && (
            <p className="text-xs text-emerald-800">{confirmProgress}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-emerald-800 hover:bg-pine-900"
              disabled={isConfirmingZip || a3Preview.entryCount === 0}
              onClick={() => void handleZipConfirm()}
            >
              {isConfirmingZip ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Confirmar importación en {companyName}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isConfirmingZip}
              onClick={resetZipImport}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

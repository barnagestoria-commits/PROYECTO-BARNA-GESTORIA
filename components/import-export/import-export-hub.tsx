"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  History,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch, apiFormFetch } from "@/lib/api-client"
import {
  ACCOUNTING_FORMAT_PROFILES,
  type AccountingSourceFormat,
} from "@/lib/imports/accounting-formats"
import { cn } from "@/lib/utils"

type HubTab = "importar" | "exportar" | "historial"

interface ImportHistoryItem {
  id: string
  fileName: string
  sourceFormatLabel: string
  fileFormat: string
  status: "PENDIENTE" | "PROCESADO" | "ERROR"
  rowsImported: number
  errorMessage: string | null
  createdAt: string
}

interface ImportResult {
  rowsImported: number
  entriesCreated: number
  fileName: string
  sourceFormat: AccountingSourceFormat
}

const TAB_ITEMS: { id: HubTab; label: string; icon: typeof Upload }[] = [
  { id: "importar", label: "Importar", icon: ArrowDownToLine },
  { id: "exportar", label: "Exportar", icon: ArrowUpFromLine },
  { id: "historial", label: "Historial", icon: History },
]

export function ImportExportHub() {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get("tab") as HubTab) ?? "importar"
  const [activeTab, setActiveTab] = useState<HubTab>(
    TAB_ITEMS.some((tab) => tab.id === initialTab) ? initialTab : "importar",
  )
  const [selectedFormat, setSelectedFormat] = useState<AccountingSourceFormat>("a3")
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [history, setHistory] = useState<ImportHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [exportFrom, setExportFrom] = useState("")
  const [exportTo, setExportTo] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeProfile = useMemo(
    () => ACCOUNTING_FORMAT_PROFILES.find((profile) => profile.id === selectedFormat)!,
    [selectedFormat],
  )

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const data = await apiFetch<{ success: true; imports: ImportHistoryItem[] }>(
        "/api/imports/history",
      )
      setHistory(data.imports)
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === "historial") {
      loadHistory()
    }
  }, [activeTab, loadHistory])

  const handleImport = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file || isImporting) return

    setIsImporting(true)
    setImportError(null)
    setImportMessage(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("sourceFormat", selectedFormat)

      const data = await apiFormFetch<{ success: true; import: ImportResult }>(
        "/api/imports/accounting",
        formData,
      )

      setImportMessage(
        `Importación desde ${activeProfile.name} completada: ${data.import.rowsImported} líneas → ${data.import.entriesCreated} asientos.`,
      )
      if (activeTab === "historial") await loadHistory()
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Error al importar el archivo.")
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleExport = async (fileType: "csv" | "xlsx") => {
    setIsExporting(true)
    setExportMessage(null)

    try {
      const params = new URLSearchParams({
        format: selectedFormat,
        fileType,
      })
      if (exportFrom) params.set("from", exportFrom)
      if (exportTo) params.set("to", exportTo)

      const response = await fetch(`/api/exports/accounting?${params.toString()}`, {
        credentials: "include",
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? "No se pudo generar la exportación.")
      }

      const blob = await response.blob()
      const disposition = response.headers.get("Content-Disposition") ?? ""
      const match = disposition.match(/filename="(.+)"/)
      const fileName = match?.[1] ?? `export-${selectedFormat}.${fileType}`

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = fileName
      anchor.click()
      URL.revokeObjectURL(url)

      const rows = response.headers.get("X-Rows-Exported")
      setExportMessage(
        `Exportación ${activeProfile.name} (${fileType.toUpperCase()}) descargada${rows ? `: ${rows} líneas` : ""}.`,
      )
    } catch (error) {
      setExportMessage(
        error instanceof Error ? error.message : "Error al exportar los asientos contables.",
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm font-medium text-emerald-700">
          <FileSpreadsheet className="h-4 w-4" />
          Intercambio contable
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-pine-900 sm:text-3xl">
          Importación y exportación
        </h1>
        <p className="mt-1 text-sm text-graphite-500">
          Compatible con A3, Holded, Sage y plantillas CSV/Excel genéricas.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TAB_ITEMS.map((tab) => {
          const Icon = tab.icon
          return (
            <Button
              key={tab.id}
              type="button"
              variant={activeTab === tab.id ? "default" : "outline"}
              className={activeTab === tab.id ? "bg-emerald-800 hover:bg-pine-900" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {tab.label}
            </Button>
          )
        })}
      </div>

      <Card className="border-sand-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-pine-900">Origen / destino del software</CardTitle>
          <CardDescription>
            Selecciona el programa contable para mapear columnas al importar y generar el layout
            correcto al exportar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ACCOUNTING_FORMAT_PROFILES.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => setSelectedFormat(profile.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  selectedFormat === profile.id
                    ? "border-emerald-400 bg-emerald-50/70 shadow-sm"
                    : "border-sand-200 bg-white hover:border-emerald-200",
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {profile.vendor}
                </p>
                <p className="mt-1 font-medium text-pine-900">{profile.name}</p>
                <p className="mt-2 text-xs text-graphite-500">{profile.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {activeTab === "importar" && (
        <Card className="border-sand-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-pine-900">
              <Upload className="h-5 w-5 text-emerald-700" />
              Importar asientos contables
            </CardTitle>
            <CardDescription>
              Arrastra un archivo exportado desde {activeProfile.name}. Extensiones:{" "}
              {activeProfile.extensions.join(", ")}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center",
                isImporting
                  ? "border-emerald-300 bg-emerald-50/40"
                  : "border-sand-300 bg-sand-50/40 hover:border-emerald-300",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={activeProfile.extensions.join(",")}
                className="hidden"
                onChange={(event) => handleImport(event.target.files)}
              />
              {isImporting ? (
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-700" />
              ) : (
                <FileSpreadsheet className="mb-3 h-8 w-8 text-emerald-700" />
              )}
              <p className="text-sm font-medium text-pine-900">
                {isImporting ? "Procesando archivo..." : "Arrastra tu archivo o selecciónalo"}
              </p>
              <p className="mt-1 text-xs text-graphite-500">
                Columnas detectadas automáticamente según {activeProfile.name}
              </p>
              <Button
                type="button"
                className="mt-4 bg-emerald-800 hover:bg-pine-900"
                disabled={isImporting}
                onClick={() => fileInputRef.current?.click()}
              >
                Seleccionar archivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "exportar" && (
        <Card className="border-sand-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-pine-900">
              <ArrowUpFromLine className="h-5 w-5 text-emerald-700" />
              Exportar asientos contables
            </CardTitle>
            <CardDescription>
              Genera un fichero compatible con {activeProfile.name} a partir del diario actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="export-from">Desde (opcional)</Label>
                <Input
                  id="export-from"
                  type="date"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="export-to">Hasta (opcional)</Label>
                <Input
                  id="export-to"
                  type="date"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                />
              </div>
            </div>

            {exportMessage && (
              <p className="rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm text-graphite-700">
                {exportMessage}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-emerald-800 hover:bg-pine-900"
                disabled={isExporting}
                onClick={() => handleExport("csv")}
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpFromLine className="mr-2 h-4 w-4" />
                )}
                Descargar CSV ({activeProfile.csvDelimiter === ";" ? ";" : ","})
              </Button>
              <Button type="button" variant="outline" disabled={isExporting} onClick={() => handleExport("xlsx")}>
                Descargar Excel (.xlsx)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "historial" && (
        <Card className="border-sand-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-pine-900">
              <History className="h-5 w-5 text-emerald-700" />
              Historial de importaciones
            </CardTitle>
            <CardDescription>Últimos ficheros procesados para la empresa activa.</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
              </div>
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-sm text-graphite-500">
                Todavía no hay importaciones registradas.
              </p>
            ) : (
              <ul className="divide-y divide-sand-100 rounded-xl border border-sand-200">
                {history.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-pine-900">{item.fileName}</p>
                      <p className="text-xs text-graphite-500">
                        {item.sourceFormatLabel} · {item.fileFormat.toUpperCase()} ·{" "}
                        {new Date(item.createdAt).toLocaleString("es-ES")}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-sand-300">
                      {item.rowsImported} líneas
                    </Badge>
                    <ImportStatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ImportStatusBadge({ status }: { status: ImportHistoryItem["status"] }) {
  if (status === "PROCESADO") {
    return (
      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        OK
      </Badge>
    )
  }
  if (status === "ERROR") {
    return (
      <Badge className="border-red-200 bg-red-50 text-red-700 hover:bg-red-50">
        <XCircle className="mr-1 h-3 w-3" />
        Error
      </Badge>
    )
  }
  return (
    <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
      <Clock3 className="mr-1 h-3 w-3" />
      Pendiente
    </Badge>
  )
}

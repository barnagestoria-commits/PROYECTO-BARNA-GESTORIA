"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowUpFromLine,
  Building2,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  History,
  Landmark,
  Loader2,
  Upload,
  Users,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRequireAuth } from "@/components/auth-provider"
import { A3CompanyImportPanel } from "@/components/import-export/a3-company-import-panel"
import { PortfolioImportPanel } from "@/components/import-export/portfolio-import-panel"
import { apiFetch } from "@/lib/api-client"
import {
  ACCOUNTING_FORMAT_PROFILES,
  type AccountingSourceFormat,
} from "@/lib/imports/accounting-formats"
import { cn } from "@/lib/utils"

type HubTab =
  | "empresa-cliente"
  | "cartera"
  | "contabilidad-interna"
  | "exportar"
  | "historial"

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

const PRIMARY_TABS: { id: HubTab; label: string; icon: typeof Upload; description: string }[] = [
  {
    id: "empresa-cliente",
    label: "Importar a Empresa Cliente",
    icon: Building2,
    description: "Volcar diario y subcuentas en una empresa concreta de la cartera",
  },
  {
    id: "cartera",
    label: "Fichero General de Clientes",
    icon: Users,
    description: "Migrar la cartera completa (ZIP, CSV o Excel)",
  },
  {
    id: "contabilidad-interna",
    label: "Contabilidad Interna de la Gestoría",
    icon: Landmark,
    description: "Libros diarios propios de la gestoría (no clientes)",
  },
]

const LEGACY_TAB_MAP: Record<string, HubTab> = {
  importar: "empresa-cliente",
  exportar: "exportar",
  historial: "historial",
}

function resolveInitialTab(raw: string | null): HubTab {
  if (!raw) return "empresa-cliente"
  const mapped = LEGACY_TAB_MAP[raw] ?? raw
  const allTabs: HubTab[] = [
    "empresa-cliente",
    "cartera",
    "contabilidad-interna",
    "exportar",
    "historial",
  ]
  return allTabs.includes(mapped as HubTab) ? (mapped as HubTab) : "empresa-cliente"
}

export function ImportExportHub() {
  const searchParams = useSearchParams()
  const { session } = useRequireAuth()
  const initialTab = resolveInitialTab(searchParams.get("tab"))
  const [activeTab, setActiveTab] = useState<HubTab>(initialTab)

  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [selectedFormat, setSelectedFormat] = useState<AccountingSourceFormat>("wk-asesor")
  const [history, setHistory] = useState<ImportHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyCompanyId, setHistoryCompanyId] = useState<string>("")
  const [exportFrom, setExportFrom] = useState("")
  const [exportTo, setExportTo] = useState("")
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  const clientCompanies = useMemo(() => {
    if (!session) return []
    return session.companies
  }, [session])

  const gestoriaOwnCompany = useMemo(() => {
    if (!session || clientCompanies.length === 0) return null
    const byAccountName = clientCompanies.find(
      (company) => company.name.trim().toLowerCase() === session.user.accountName.trim().toLowerCase(),
    )
    return byAccountName ?? clientCompanies[0]
  }, [clientCompanies, session])

  const selectedClient = useMemo(
    () => clientCompanies.find((company) => company.id === selectedClientId) ?? null,
    [clientCompanies, selectedClientId],
  )

  useEffect(() => {
    if (selectedClientId || clientCompanies.length === 0) return
    setSelectedClientId(clientCompanies[0].id)
  }, [clientCompanies, selectedClientId])

  useEffect(() => {
    if (historyCompanyId || clientCompanies.length === 0) return
    setHistoryCompanyId(clientCompanies[0].id)
  }, [clientCompanies, historyCompanyId])

  const activeProfile = useMemo(
    () => ACCOUNTING_FORMAT_PROFILES.find((profile) => profile.id === selectedFormat)!,
    [selectedFormat],
  )

  const loadHistory = useCallback(async () => {
    if (!historyCompanyId) return
    setHistoryLoading(true)
    try {
      const data = await apiFetch<{ success: true; imports: ImportHistoryItem[] }>(
        `/api/imports/history?companyId=${encodeURIComponent(historyCompanyId)}`,
      )
      setHistory(data.imports)
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [historyCompanyId])

  useEffect(() => {
    if (activeTab === "historial") {
      void loadHistory()
    }
  }, [activeTab, loadHistory])

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

  if (!session) return null

  const isGestoria = session.user.accountType === "GESTORIA"

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm font-medium text-emerald-700">
          <FileSpreadsheet className="h-4 w-4" />
          {isGestoria ? "Panel de importación de la gestoría" : "Intercambio contable"}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-pine-900 sm:text-3xl">
          Importación
        </h1>
        <p className="mt-1 text-sm text-graphite-500">
          {isGestoria
            ? "Importa contabilidad de clientes, migra carteras completas o gestiona los libros internos de la gestoría."
            : "Compatible con ZIP, DAT, TXT, CSV y Excel."}
        </p>
      </div>

      {isGestoria ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  activeTab === tab.id
                    ? "border-emerald-400 bg-emerald-50/70 shadow-sm"
                    : "border-sand-200 bg-white hover:border-emerald-200",
                )}
              >
                <Icon
                  className={cn(
                    "mb-2 h-5 w-5",
                    activeTab === tab.id ? "text-emerald-800" : "text-graphite-500",
                  )}
                />
                <p className="text-sm font-semibold text-pine-900">{tab.label}</p>
                <p className="mt-1 text-xs text-graphite-500">{tab.description}</p>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={activeTab === "empresa-cliente" ? "default" : "outline"}
            className={activeTab === "empresa-cliente" ? "bg-emerald-800 hover:bg-pine-900" : ""}
            onClick={() => setActiveTab("empresa-cliente")}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button
            type="button"
            variant={activeTab === "exportar" ? "default" : "outline"}
            className={activeTab === "exportar" ? "bg-emerald-800 hover:bg-pine-900" : ""}
            onClick={() => setActiveTab("exportar")}
          >
            <ArrowUpFromLine className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button
            type="button"
            variant={activeTab === "historial" ? "default" : "outline"}
            className={activeTab === "historial" ? "bg-emerald-800 hover:bg-pine-900" : ""}
            onClick={() => setActiveTab("historial")}
          >
            <History className="mr-2 h-4 w-4" />
            Historial
          </Button>
        </div>
      )}

      {activeTab === "empresa-cliente" && (
        <Card className="border-sand-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-pine-900">
              <Building2 className="h-5 w-5 text-emerald-700" />
              Importar a Empresa Cliente
            </CardTitle>
            <CardDescription>
              Selecciona la empresa destino y sube un paquete ZIP con diario y subcuentas.
              Todos los asientos quedarán aislados en esa empresa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {clientCompanies.length === 0 ? (
              <p className="text-sm text-graphite-500">
                No hay empresas disponibles. Da de alta clientes en la cartera antes de importar.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="import-client-select">Empresa cliente destino</Label>
                  <select
                    id="import-client-select"
                    value={selectedClientId}
                    onChange={(event) => setSelectedClientId(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-md"
                  >
                    {clientCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                        {company.cif ? ` · ${company.cif}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedClient && (
                  <A3CompanyImportPanel
                    key={selectedClient.id}
                    companyId={selectedClient.id}
                    companyName={selectedClient.name}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "cartera" && (
        <Card className="border-sand-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-pine-900">
              <Users className="h-5 w-5 text-emerald-700" />
              Importar Fichero General de Clientes / Empresas
            </CardTitle>
            <CardDescription>
              Migración masiva de cartera: da de alta las empresas y vuelca automáticamente
              la contabilidad de cada carpeta E00xxx detectada en el ZIP.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PortfolioImportPanel />
          </CardContent>
        </Card>
      )}

      {activeTab === "contabilidad-interna" && (
        <Card className="border-sand-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-pine-900">
              <Landmark className="h-5 w-5 text-emerald-700" />
              Contabilidad Interna de la Gestoría
            </CardTitle>
            <CardDescription>
              Importa los libros diarios propios de la gestoría (honorarios, gastos internos, etc.).
              No afecta a la contabilidad de empresas cliente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {gestoriaOwnCompany ? (
              <>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900">
                  <span className="font-medium">Empresa gestora:</span> {gestoriaOwnCompany.name}
                  {gestoriaOwnCompany.cif ? ` · NIF ${gestoriaOwnCompany.cif}` : ""}
                </div>
                <A3CompanyImportPanel
                  key={gestoriaOwnCompany.id}
                  companyId={gestoriaOwnCompany.id}
                  companyName={gestoriaOwnCompany.name}
                />
              </>
            ) : (
              <p className="text-sm text-graphite-500">
                No se encontró la empresa interna de la gestoría.
              </p>
            )}
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
              Genera un fichero compatible con {activeProfile.name} a partir del diario de la
              empresa activa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                </button>
              ))}
            </div>

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
                onClick={() => void handleExport("csv")}
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpFromLine className="mr-2 h-4 w-4" />
                )}
                Descargar CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isExporting}
                onClick={() => void handleExport("xlsx")}
              >
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
            <CardDescription>
              Ficheros procesados por empresa. Selecciona la empresa para filtrar el historial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {clientCompanies.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="history-company-select">Empresa</Label>
                <select
                  id="history-company-select"
                  value={historyCompanyId}
                  onChange={(event) => setHistoryCompanyId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-md"
                >
                  {clientCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                      {company.cif ? ` · ${company.cif}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
              </div>
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-sm text-graphite-500">
                Todavía no hay importaciones registradas para esta empresa.
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

      {isGestoria && activeTab !== "exportar" && activeTab !== "historial" && (
        <div className="flex flex-wrap gap-2 border-t border-sand-200 pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTab("exportar")}>
            <ArrowUpFromLine className="mr-1.5 h-4 w-4" />
            Exportar asientos
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTab("historial")}>
            <History className="mr-1.5 h-4 w-4" />
            Ver historial
          </Button>
        </div>
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

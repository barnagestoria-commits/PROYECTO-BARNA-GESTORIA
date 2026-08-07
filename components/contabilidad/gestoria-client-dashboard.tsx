"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  BookOpen,
  Calculator,
  CalendarRange,
  FileSpreadsheet,
  Landmark,
  Loader2,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { FiscalPanoramaMatrix } from "@/components/fiscal-panorama-matrix"
import { FiscalModelsConfigButton } from "@/components/fiscal/fiscal-models-config-panel"
import { ClientA3ImportDialog } from "@/components/contabilidad/client-a3-import-dialog"
import { useRequireAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api-client"
import { mapCompaniesToGestoriaRows } from "@/lib/contabilidad/gestoria-companies"
import type { GestoriaClientProfileDto } from "@/lib/contabilidad/gestoria-client-profile-types"
import type { FiscalPanoramaResponse } from "@/lib/types/fiscal-panorama"
import { cn } from "@/lib/utils"

const WORKSPACE_TABS = [
  { id: "resumen", label: "Resumen", icon: FileSpreadsheet },
  { id: "apuntes", label: "Apuntes / Movimientos", icon: BookOpen },
  { id: "iva", label: "Resumen de IVA", icon: Landmark },
  { id: "plan", label: "Plan Contable", icon: Calculator },
] as const

type WorkspaceTabId = (typeof WORKSPACE_TABS)[number]["id"]

interface GestoriaClientDashboardProps {
  companyId: string
}

export function GestoriaClientDashboard({ companyId }: GestoriaClientDashboardProps) {
  const router = useRouter()
  const { session, setActiveCompany } = useRequireAuth()
  const currentYear = new Date().getFullYear()
  const currentMonthLabel = new Date().toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  })

  const [year, setYear] = useState(currentYear)
  const [panorama, setPanorama] = useState<FiscalPanoramaResponse | null>(null)
  const [profiles, setProfiles] = useState<Map<string, GestoriaClientProfileDto>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSwitchingCompany, setIsSwitchingCompany] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>("resumen")

  const company = useMemo(
    () => session?.companies.find((item) => item.id === companyId) ?? null,
    [companyId, session?.companies],
  )

  const row = useMemo(() => {
    const rows = mapCompaniesToGestoriaRows(session?.companies ?? [], "cloud", profiles)
    return rows.find((item) => item.id === companyId) ?? null
  }, [companyId, profiles, session?.companies])

  useEffect(() => {
    if (!session || session.user.accountType !== "GESTORIA") return

    void apiFetch<{ success: true; profiles: Record<string, GestoriaClientProfileDto> }>(
      "/api/companies/profiles",
    )
      .then((data) => setProfiles(new Map(Object.entries(data.profiles))))
      .catch(() => setProfiles(new Map()))
  }, [session])

  const ensureActiveCompany = useCallback(async () => {
    if (!session || session.activeCompanyId === companyId) return
    setIsSwitchingCompany(true)
    try {
      await setActiveCompany(companyId)
    } finally {
      setIsSwitchingCompany(false)
    }
  }, [companyId, session, setActiveCompany])

  const loadPanorama = useCallback(async () => {
    if (!session || !company) return

    setIsLoading(true)
    setError(null)
    try {
      await ensureActiveCompany()
      const data = await apiFetch<{ success: true; panorama: FiscalPanoramaResponse }>(
        `/api/fiscal/panorama?year=${year}`,
      )
      setPanorama(data.panorama)
    } catch (err) {
      setPanorama(null)
      setError(err instanceof Error ? err.message : "No se pudo cargar el resumen fiscal.")
    } finally {
      setIsLoading(false)
    }
  }, [company, ensureActiveCompany, session, year])

  useEffect(() => {
    if (company && activeTab === "resumen") {
      void loadPanorama()
    }
  }, [activeTab, company, loadPanorama])

  const openWorkspace = async (destination: "/dashboard/contabilidad" | "/dashboard/fiscal") => {
    await ensureActiveCompany()
    router.push(destination)
  }

  if (!session) {
    return null
  }

  if (session.user.accountType !== "GESTORIA") {
    return (
      <div className="rounded-xl border border-sand-200 bg-white px-6 py-10 text-center text-gray-600">
        <p>Esta sección está disponible solo para cuentas de gestoría.</p>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="rounded-xl border border-sand-200 bg-white px-6 py-10 text-center text-gray-600">
        <p>No se encontró la empresa cliente seleccionada.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/dashboard/contabilidad/clientes-gestoria">Volver al listado</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            type="button"
            variant="ghost"
            className="mb-2 h-8 px-2 text-graphite-600 hover:text-pine-900"
            onClick={() => router.push("/dashboard/contabilidad/clientes-gestoria")}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver al listado
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-pine-900">
            Situación de la empresa
          </h1>
          <p className="mt-1 text-sm text-graphite-500">
            Resumen periódico de impuestos y modelos a pagar
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="bg-emerald-800 hover:bg-pine-900"
            onClick={() => setImportDialogOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importar contabilidad (ZIP/TXT)
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSwitchingCompany}
            onClick={() => void openWorkspace("/dashboard/contabilidad")}
          >
            Contabilidad
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSwitchingCompany}
            onClick={() => void openWorkspace("/dashboard/fiscal")}
          >
            Impuestos
          </Button>
        </div>
      </div>

      <ClientA3ImportDialog
        open={importDialogOpen}
        companyId={companyId}
        companyName={company.name}
        companyCif={company.cif ?? row?.cif}
        onClose={() => setImportDialogOpen(false)}
      />

      <div className="overflow-hidden rounded-lg border border-sand-300 bg-white shadow-sm">
        <div className="border-b border-sand-200 bg-gradient-to-r from-emerald-900 to-emerald-800 px-4 py-3 text-white">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-emerald-100/80">Empresa</p>
              <p className="font-semibold">
                {row?.code ?? "—"} · {company.name}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-emerald-100/80">N.I.F.</p>
              <p className="font-semibold">{company.cif ?? row?.cif ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-emerald-100/80">Tipo</p>
              <p className="font-semibold">{row?.type ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-emerald-100/80">Fecha datos</p>
              <p className="font-semibold capitalize">{currentMonthLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-sand-200 bg-sand-50 px-2 py-2" role="tablist">
          {WORKSPACE_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                  isActive
                    ? "border-emerald-800 bg-emerald-800 text-white shadow-sm"
                    : "border-transparent bg-white text-pine-900 hover:border-emerald-300 hover:bg-emerald-50/60",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-6">
          {activeTab === "resumen" && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <CalendarRange className="h-4 w-4 text-graphite-500" />
                <label htmlFor="gestoria-client-year" className="text-sm font-medium text-graphite-700">
                  Ejercicio
                </label>
                <select
                  id="gestoria-client-year"
                  value={year}
                  onChange={(event) => setYear(Number.parseInt(event.target.value, 10))}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2 text-xs text-graphite-600">
                  <span className="rounded border border-emerald-300 bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
                    Presentado
                  </span>
                  <span className="rounded border border-red-300 bg-red-100 px-2 py-1 font-semibold text-red-800">
                    Pendiente / SD
                  </span>
                </div>
                <FiscalModelsConfigButton onSaved={() => void loadPanorama()} />
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-emerald-800">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Cargando resumen fiscal...
                </div>
              ) : error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-800">
                  {error}
                </div>
              ) : panorama ? (
                <FiscalPanoramaMatrix panorama={panorama} />
              ) : null}
            </>
          )}

          {activeTab === "apuntes" && (
            <div className="flex items-center justify-center py-16 text-sm text-graphite-600">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-700" />
              Cargando libro diario de la empresa...
            </div>
          )}

          {activeTab === "iva" && (
            <div className="flex items-center justify-center py-16 text-sm text-graphite-600">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-700" />
              Cargando modelos de IVA de la empresa...
            </div>
          )}

          {activeTab === "plan" && (
            <div className="flex items-center justify-center py-16 text-sm text-graphite-600">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-700" />
              Cargando plan de cuentas de la empresa...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

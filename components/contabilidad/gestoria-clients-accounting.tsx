"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CircleDollarSign,
  FileSpreadsheet,
  HelpCircle,
  Loader2,
  Printer,
  Square,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRequireAuth } from "@/components/auth-provider"
import { cn } from "@/lib/utils"
import {
  EMPTY_GESTORIA_COMPANY_FILTERS,
  filterGestoriaCompanyRows,
  mapCompaniesToGestoriaRows,
  type GestoriaCompanyFilters,
  type GestoriaCompanyRow,
} from "@/lib/contabilidad/gestoria-companies"

const GRID_COLUMNS =
  "grid grid-cols-[72px_minmax(180px,1.4fr)_140px_56px_minmax(160px,1fr)]"

function FilterCell({
  value,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  "aria-label": string
}) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      className="h-8 rounded-none border-0 border-r border-sand-300 bg-white px-2 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-emerald-500"
    />
  )
}

export function GestoriaClientsAccountingPage() {
  const { session, activeCompany, setActiveCompany } = useRequireAuth()
  const router = useRouter()

  const [filters, setFilters] = useState<GestoriaCompanyFilters>(EMPTY_GESTORIA_COMPANY_FILTERS)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState("Seleccione una empresa de la lista.")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const rows = useMemo(
    () => mapCompaniesToGestoriaRows(session?.companies ?? []),
    [session?.companies],
  )

  const filteredRows = useMemo(() => filterGestoriaCompanyRows(rows, filters), [rows, filters])

  const selectedRow = useMemo(
    () => filteredRows.find((row) => row.id === selectedCompanyId) ?? null,
    [filteredRows, selectedCompanyId],
  )

  useEffect(() => {
    if (activeCompany && rows.some((row) => row.id === activeCompany.id)) {
      setSelectedCompanyId(activeCompany.id)
    }
  }, [activeCompany, rows])

  useEffect(() => {
    if (selectedRow) {
      setStatusMessage(`${selectedRow.code} · ${selectedRow.name} · ${selectedRow.type}`)
      return
    }

    setStatusMessage(
      filteredRows.length === 0
        ? "No hay empresas que coincidan con los filtros."
        : `${filteredRows.length} empresa${filteredRows.length === 1 ? "" : "s"} encontrada${filteredRows.length === 1 ? "" : "s"}.`,
    )
  }, [filteredRows.length, selectedRow])

  const updateFilter = (key: keyof GestoriaCompanyFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const openCompanyWorkspace = useCallback(
    async (companyId: string, destination: "/dashboard/contabilidad" | "/dashboard/fiscal") => {
      if (!session) return

      setIsSubmitting(true)
      try {
        if (session.activeCompanyId !== companyId) {
          await setActiveCompany(companyId)
        }
        router.push(destination)
      } finally {
        setIsSubmitting(false)
      }
    },
    [router, session, setActiveCompany],
  )

  const handleAccept = async () => {
    if (!selectedRow) {
      setStatusMessage("Seleccione una empresa antes de continuar.")
      return
    }
    await openCompanyWorkspace(selectedRow.id, "/dashboard/contabilidad")
  }

  const handleEjercicios = async () => {
    if (!selectedRow) {
      setStatusMessage("Seleccione una empresa para consultar sus ejercicios.")
      return
    }
    await openCompanyWorkspace(selectedRow.id, "/dashboard/contabilidad")
  }

  const handleList = () => {
    setFilters(EMPTY_GESTORIA_COMPANY_FILTERS)
    setStatusMessage(`Listado completo: ${rows.length} empresas de la gestoría.`)
  }

  const handleCancel = () => {
    setSelectedCompanyId(null)
    setFilters(EMPTY_GESTORIA_COMPANY_FILTERS)
    setStatusMessage("Operación cancelada.")
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

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-pine-900">Contabilidad Clientes Gestoría</h1>
        <p className="mt-1 text-sm text-graphite-500">
          Buscador de empresas cliente · modo nube (documentación centralizada en Barna Gestoría)
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-sand-300 bg-sand-100 shadow-sm">
        <div className="border-b border-sand-300 bg-gradient-to-r from-sand-200 to-sand-100 px-3 py-2">
          <p className="text-sm font-semibold text-pine-900">Empresas</p>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-sand-300 bg-sand-50 px-2 py-1.5">
          <ToolbarIconButton label="Selección" icon={Square} disabled />
          <ToolbarIconButton label="Imprimir listado" icon={Printer} onClick={() => window.print()} />
          <ToolbarIconButton
            label="Exportar listado"
            icon={FileSpreadsheet}
            onClick={handleList}
          />
          <ToolbarIconButton label="Tarifas" icon={CircleDollarSign} disabled badge="Próx." />
          <ToolbarIconButton
            label="Ayuda"
            icon={HelpCircle}
            onClick={() =>
              setStatusMessage(
                "En modo nube la documentación se guarda en el repositorio de Barna Gestoría por cliente. En instalación de escritorio se usará ruta local tipo A3.",
              )
            }
          />
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="min-w-0 flex-1">
            <div className={cn(GRID_COLUMNS, "border-b border-sand-300 bg-sand-100 text-[11px] font-semibold uppercase tracking-wide text-graphite-600")}>
              <div className="border-r border-sand-300 px-2 py-2">Cód.</div>
              <div className="border-r border-sand-300 px-2 py-2">Nombre Empresa</div>
              <div className="border-r border-sand-300 px-2 py-2">Tipo</div>
              <div className="border-r border-sand-300 px-2 py-2">Res</div>
              <div className="px-2 py-2">Camino de Acceso</div>
            </div>

            <div className={cn(GRID_COLUMNS, "border-b border-sand-300 bg-sand-200/80")}>
              <FilterCell
                value={filters.code}
                onChange={(value) => updateFilter("code", value)}
                aria-label="Filtrar por código"
              />
              <FilterCell
                value={filters.name}
                onChange={(value) => updateFilter("name", value)}
                aria-label="Filtrar por nombre de empresa"
              />
              <FilterCell
                value={filters.type}
                onChange={(value) => updateFilter("type", value)}
                aria-label="Filtrar por tipo"
              />
              <FilterCell
                value={filters.res}
                onChange={(value) => updateFilter("res", value)}
                aria-label="Filtrar por res"
              />
              <FilterCell
                value={filters.accessPath}
                onChange={(value) => updateFilter("accessPath", value)}
                aria-label="Filtrar por camino de acceso"
              />
            </div>

            <div className="max-h-[420px] overflow-auto bg-white">
              {rows.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-graphite-500">
                  Aún no tienes empresas clientes asignadas a tu gestoría.
                </p>
              ) : filteredRows.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-graphite-500">
                  No hay empresas que coincidan con los filtros aplicados.
                </p>
              ) : (
                filteredRows.map((row) => (
                  <CompanyGridRow
                    key={row.id}
                    row={row}
                    selected={row.id === selectedCompanyId}
                    onSelect={() => setSelectedCompanyId(row.id)}
                    onAccept={() => openCompanyWorkspace(row.id, "/dashboard/contabilidad")}
                  />
                ))
              )}
            </div>
          </div>

          <aside className="flex flex-row gap-2 border-t border-sand-300 bg-sand-50 p-3 lg:w-36 lg:flex-col lg:border-l lg:border-t-0">
            <SidebarActionButton
              label="Ejercicios"
              disabled={!selectedRow || isSubmitting}
              onClick={handleEjercicios}
            />
            <SidebarActionButton label="Socios" disabled />
            <SidebarActionButton label="Filiales" disabled />
          </aside>
        </div>

        <div className="flex flex-col gap-2 border-t border-sand-300 bg-sand-50 px-2 py-2 sm:flex-row sm:items-center">
          <Input
            readOnly
            value={statusMessage}
            aria-label="Estado"
            className="h-9 flex-1 rounded-md border-sand-300 bg-white text-sm text-graphite-700 shadow-none"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 min-w-[88px] rounded-md border-sand-300 bg-white"
              onClick={handleList}
            >
              Listar
            </Button>
            <Button
              type="button"
              className="h-9 min-w-[88px] rounded-md bg-emerald-800 hover:bg-pine-900"
              disabled={!selectedRow || isSubmitting}
              onClick={handleAccept}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceptar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 min-w-[88px] rounded-md border-sand-300 bg-white"
              onClick={handleCancel}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolbarIconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  badge,
}: {
  label: string
  icon: typeof Square
  onClick?: () => void
  disabled?: boolean
  badge?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-md border border-sand-300 bg-white text-graphite-700 shadow-sm transition-colors",
        disabled
          ? "cursor-not-allowed opacity-45"
          : "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800",
      )}
    >
      <Icon className="h-4 w-4" />
      {badge && (
        <span className="absolute -right-1 -top-1 rounded bg-gold-100 px-1 text-[8px] font-bold text-gold-800">
          {badge}
        </span>
      )}
    </button>
  )
}

function SidebarActionButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-10 w-full rounded-md border-sand-300 bg-white text-sm font-medium text-graphite-800 shadow-sm",
        !disabled && "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900",
      )}
    >
      {label}
    </Button>
  )
}

function CompanyGridRow({
  row,
  selected,
  onSelect,
  onAccept,
}: {
  row: GestoriaCompanyRow
  selected: boolean
  onSelect: () => void
  onAccept: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onAccept}
      className={cn(
        GRID_COLUMNS,
        "w-full border-b border-sand-200 text-left font-mono text-xs transition-colors",
        selected
          ? "bg-emerald-100 text-emerald-950"
          : "bg-white text-graphite-800 hover:bg-sand-50",
      )}
    >
      <span className="border-r border-sand-200 px-2 py-2">{row.code}</span>
      <span className="truncate border-r border-sand-200 px-2 py-2 font-sans text-sm">{row.name}</span>
      <span className="truncate border-r border-sand-200 px-2 py-2 font-sans">{row.type}</span>
      <span className="border-r border-sand-200 px-2 py-2">{row.res}</span>
      <span className="truncate px-2 py-2">{row.accessPath}</span>
    </button>
  )
}

"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  CircleDollarSign,
  FileSpreadsheet,
  HelpCircle,
  Loader2,
  MoreVertical,
  Pencil,
  Printer,
  Square,
  Trash2,
  UserPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRequireAuth } from "@/components/auth-provider"
import { AddGestoriaClientDialog } from "@/components/contabilidad/add-gestoria-client-dialog"
import { EditGestoriaClientDialog } from "@/components/contabilidad/edit-gestoria-client-dialog"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-client"
import type { GestoriaClientProfileDto } from "@/lib/contabilidad/gestoria-client-profile-types"
import {
  EMPTY_GESTORIA_COMPANY_FILTERS,
  filterGestoriaCompanyRows,
  mapCompaniesToGestoriaRows,
  type GestoriaCompanyFilters,
  type GestoriaCompanyRow,
} from "@/lib/contabilidad/gestoria-companies"

const GRID_COLUMNS =
  "grid grid-cols-[72px_minmax(180px,1.4fr)_140px_56px_minmax(160px,1fr)_40px]"

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
  const { session, activeCompany, setActiveCompany, refreshSession } = useRequireAuth()
  const router = useRouter()

  const [filters, setFilters] = useState<GestoriaCompanyFilters>(EMPTY_GESTORIA_COMPANY_FILTERS)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState("Seleccione una empresa de la lista.")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [addClientOpen, setAddClientOpen] = useState(false)
  const [editClientId, setEditClientId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Map<string, GestoriaClientProfileDto>>(new Map())

  const rows = useMemo(
    () => mapCompaniesToGestoriaRows(session?.companies ?? [], "cloud", profiles),
    [profiles, session?.companies],
  )

  useEffect(() => {
    if (!session || session.user.accountType !== "GESTORIA") return

    void apiFetch<{ success: true; profiles: Record<string, GestoriaClientProfileDto> }>(
      "/api/companies/profiles",
    )
      .then((data) => setProfiles(new Map(Object.entries(data.profiles))))
      .catch(() => setProfiles(new Map()))
  }, [session])

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

  const openCompanyDashboard = useCallback(
    async (companyId: string) => {
      if (!session) return

      setIsSubmitting(true)
      try {
        if (session.activeCompanyId !== companyId) {
          await setActiveCompany(companyId)
        }
        router.push(`/dashboard/contabilidad/clientes-gestoria/${companyId}`)
      } finally {
        setIsSubmitting(false)
      }
    },
    [router, session, setActiveCompany],
  )

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

  const handleClientCreated = async (companyId: string) => {
    await refreshSession()
    await reloadProfiles()
    setSelectedCompanyId(companyId)
    setFilters(EMPTY_GESTORIA_COMPANY_FILTERS)
    setStatusMessage("Cliente creado correctamente. Selecciónelo y pulse Aceptar para continuar.")
  }

  const reloadProfiles = async () => {
    try {
      const data = await apiFetch<{ success: true; profiles: Record<string, GestoriaClientProfileDto> }>(
        "/api/companies/profiles",
      )
      setProfiles(new Map(Object.entries(data.profiles)))
    } catch {
      setProfiles(new Map())
    }
  }

  const handleEditClient = (companyId: string) => {
    setOpenMenuId(null)
    setEditClientId(companyId)
  }

  const handleDeleteClient = async (row: GestoriaCompanyRow) => {
    setOpenMenuId(null)
    const confirmed = window.confirm(
      `¿Eliminar el cliente ${row.code} · ${row.name}? Esta acción no se puede deshacer.`,
    )
    if (!confirmed) return

    try {
      await apiFetch(`/api/companies/${row.id}`, { method: "DELETE" })
      if (selectedCompanyId === row.id) {
        setSelectedCompanyId(null)
      }
      await refreshSession()
      await reloadProfiles()
      setStatusMessage(`Cliente ${row.name} eliminado.`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo eliminar el cliente.")
    }
  }

  const handleClientSaved = async () => {
    await refreshSession()
    await reloadProfiles()
    setStatusMessage("Ficha de cliente actualizada correctamente.")
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

        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto border-b border-sand-300 bg-sand-50 px-2 py-1.5">
          <ToolbarIconButton label="Selección" icon={Square} disabled />
          <ToolbarIconButton label="Imprimir listado" icon={Printer} onClick={() => window.print()} />
          <ToolbarIconButton
            label="Exportar listado"
            icon={FileSpreadsheet}
            onClick={handleList}
          />
          <ToolbarIconButton label="Tarifas" icon={CircleDollarSign} disabled badge="Próx." />
          <ToolbarTextButton
            label="Agregar Persona Jurídica/Física"
            icon={UserPlus}
            onClick={() => setAddClientOpen(true)}
            dataTour="onboarding-new-account"
          />
          <ToolbarIconButton
            label="Ayuda"
            icon={HelpCircle}
            onClick={() =>
              setStatusMessage(
                "En modo nube la documentación se guarda en el repositorio de Barna Gestoría por cliente. En instalación de escritorio se usará una ruta local configurable por cliente.",
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
              <div />
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
              <div />
            </div>

            <div
              className={cn(
                "bg-white",
                filteredRows.length > 12
                  ? "max-h-[min(70vh,560px)] overflow-y-auto"
                  : "overflow-visible",
              )}
            >
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
                    menuOpen={openMenuId === row.id}
                    onToggleMenu={() =>
                      setOpenMenuId((current) => (current === row.id ? null : row.id))
                    }
                    onCloseMenu={() => setOpenMenuId(null)}
                    onSelect={() => setSelectedCompanyId(row.id)}
                    onOpenDashboard={() => void openCompanyDashboard(row.id)}
                    onAccept={() => openCompanyWorkspace(row.id, "/dashboard/contabilidad")}
                    onEdit={() => handleEditClient(row.id)}
                    onDelete={() => void handleDeleteClient(row)}
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

      <AddGestoriaClientDialog
        open={addClientOpen}
        onClose={() => setAddClientOpen(false)}
        onCreated={handleClientCreated}
      />

      <EditGestoriaClientDialog
        open={editClientId !== null}
        companyId={editClientId}
        onClose={() => setEditClientId(null)}
        onSaved={() => void handleClientSaved()}
      />
    </div>
  )
}

function ToolbarTextButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  dataTour,
}: {
  label: string
  icon: typeof Square
  onClick?: () => void
  disabled?: boolean
  dataTour?: string
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      data-tour={dataTour}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-md border border-sand-300 bg-white px-2.5 text-left text-[11px] font-medium text-graphite-700 shadow-sm transition-colors",
        disabled
          ? "cursor-not-allowed opacity-45"
          : "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
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
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onSelect,
  onOpenDashboard,
  onAccept,
  onEdit,
  onDelete,
}: {
  row: GestoriaCompanyRow
  selected: boolean
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  onSelect: () => void
  onOpenDashboard: () => void
  onAccept: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)

  const openMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (menuOpen) {
      onCloseMenu()
      setMenuPosition(null)
      return
    }

    const rect = menuButtonRef.current?.getBoundingClientRect()
    if (rect) {
      const menuWidth = 148
      setMenuPosition({
        top: rect.bottom + 4,
        left: Math.max(8, rect.right - menuWidth),
      })
    }
    onToggleMenu()
  }

  useEffect(() => {
    if (!menuOpen) {
      setMenuPosition(null)
    }
  }, [menuOpen])

  return (
    <div
      className={cn(
        GRID_COLUMNS,
        "relative w-full border-b border-sand-200 text-left font-mono text-xs transition-colors",
        selected ? "bg-emerald-100 text-emerald-950" : "bg-white text-graphite-800 hover:bg-sand-50",
      )}
    >
      <button type="button" onClick={onSelect} onDoubleClick={onOpenDashboard} className="contents">
        <span className="border-r border-sand-200 px-2 py-2">{row.code}</span>
        <span className="truncate border-r border-sand-200 px-2 py-2 font-sans text-sm">{row.name}</span>
        <span className="truncate border-r border-sand-200 px-2 py-2 font-sans">{row.type}</span>
        <span className="border-r border-sand-200 px-2 py-2">{row.res}</span>
        <span className="truncate border-r border-sand-200 px-2 py-2">{row.accessPath}</span>
      </button>
      <div className="relative flex items-center justify-center px-1 py-1">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Acciones del cliente"
          aria-expanded={menuOpen}
          onClick={openMenu}
          className="rounded p-1 text-graphite-500 hover:bg-white hover:text-pine-900"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen &&
          menuPosition &&
          typeof document !== "undefined" &&
          createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[100] cursor-default"
                aria-label="Cerrar menú"
                onClick={onCloseMenu}
              />
              <div
                className="fixed z-[101] min-w-[148px] rounded-md border border-sand-200 bg-white py-1 shadow-lg"
                style={{ top: menuPosition.top, left: menuPosition.left }}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50"
                  onClick={(event) => {
                    event.stopPropagation()
                    onEdit()
                  }}
                >
                  <Pencil className="h-4 w-4" /> Editar
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete()
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              </div>
            </>,
            document.body,
          )}
      </div>
    </div>
  )
}

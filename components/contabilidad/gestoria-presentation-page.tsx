"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Building2, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useRequireAuth } from "@/components/auth-provider"
import { GestoriaPresentationConfigForm } from "@/components/contabilidad/gestoria-presentation-config-form"
import { apiFetch } from "@/lib/api-client"
import { mapCompaniesToGestoriaRows } from "@/lib/contabilidad/gestoria-companies"
import type {
  GestoriaClientDetailDto,
  GestoriaClientProfileDto,
} from "@/lib/contabilidad/gestoria-client-profile-types"
import {
  BALANCE_FORMAT_OPTIONS,
  PROFIT_LOSS_FORMAT_OPTIONS,
  syncPresentationWithAccountingPlan,
} from "@/lib/contabilidad/gestoria-presentation-config"

export function GestoriaPresentationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session, activeCompany } = useRequireAuth()

  const [companyId, setCompanyId] = useState<string>("")
  const [name, setName] = useState("")
  const [cif, setCif] = useState("")
  const [profile, setProfile] = useState<GestoriaClientProfileDto | null>(null)
  const [profiles, setProfiles] = useState<Map<string, GestoriaClientProfileDto>>(new Map())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const rows = useMemo(
    () => mapCompaniesToGestoriaRows(session?.companies ?? [], "cloud", profiles),
    [profiles, session?.companies],
  )

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === companyId) ?? null,
    [companyId, rows],
  )

  const clientEntityType =
    profile?.entityType === "PERSONA_FISICA" ? ("fisica" as const) : ("juridica" as const)

  useEffect(() => {
    if (!session || session.user.accountType !== "GESTORIA") return

    void apiFetch<{ success: true; profiles: Record<string, GestoriaClientProfileDto> }>(
      "/api/companies/profiles",
    )
      .then((data) => setProfiles(new Map(Object.entries(data.profiles))))
      .catch(() => setProfiles(new Map()))
  }, [session])

  useEffect(() => {
    if (companyId || rows.length === 0) return
    const fromQuery = searchParams.get("companyId")
    const initial =
      (fromQuery && rows.some((row) => row.id === fromQuery) ? fromQuery : null) ??
      activeCompany?.id ??
      rows[0]?.id ??
      ""
    if (initial) setCompanyId(initial)
  }, [activeCompany?.id, companyId, rows, searchParams])

  const loadClient = useCallback(async (id: string) => {
    if (!id) {
      setProfile(null)
      return
    }

    setLoading(true)
    setError(null)
    setSavedMessage(null)

    try {
      const data = await apiFetch<{ success: true; client: GestoriaClientDetailDto }>(
        `/api/companies/${id}`,
      )
      setName(data.client.name)
      setCif(data.client.cif ?? "")
      setProfile(data.client.profile)
      router.replace(`/dashboard/contabilidad/presentacion-fiscal?companyId=${id}`, {
        scroll: false,
      })
    } catch (err) {
      setProfile(null)
      setError(err instanceof Error ? err.message : "No se pudo cargar la ficha del cliente.")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (!companyId) return
    void loadClient(companyId)
  }, [companyId, loadClient])

  const handleAccountingPlanChange = (
    accountingPlanType: GestoriaClientProfileDto["accountingPlanType"],
  ) => {
    if (!profile) return
    setProfile({
      ...profile,
      accountingPlanType,
      presentation: syncPresentationWithAccountingPlan(
        profile.presentation,
        accountingPlanType,
        clientEntityType,
      ),
    })
  }

  const handlePresentationChange = (
    presentation: GestoriaClientProfileDto["presentation"],
  ) => {
    if (!profile) return
    setProfile({
      ...profile,
      presentation,
      impresos: {
        ...profile.impresos,
        model232: presentation.model232Enabled,
      },
    })
  }

  const handleSave = async () => {
    if (!companyId || !profile) return

    setSaving(true)
    setError(null)
    setSavedMessage(null)

    try {
      await apiFetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, cif, profile }),
      })
      setProfiles((current) => {
        const next = new Map(current)
        next.set(companyId, profile)
        return next
      })
      setSavedMessage("Configuración de presentación fiscal guardada correctamente.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración.")
    } finally {
      setSaving(false)
    }
  }

  if (!session) return null

  if (session.user.accountType !== "GESTORIA") {
    return (
      <div className="rounded-xl border border-sand-200 bg-white px-6 py-10 text-center text-gray-600">
        <p>Esta sección está disponible solo para cuentas de gestoría.</p>
      </div>
    )
  }

  const balanceLabel = profile
    ? BALANCE_FORMAT_OPTIONS.find((item) => item.id === profile.presentation.balanceFormat)?.label
    : null
  const pygLabel = profile
    ? PROFIT_LOSS_FORMAT_OPTIONS.find((item) => item.id === profile.presentation.profitLossFormat)
        ?.label
    : null

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-pine-900">
            Presentación fiscal y cuentas anuales
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-graphite-500">
            Plan contable, balances, impuesto de sociedades, modelo 232 y legalización de libros —
            como en A3SOC al dar de alta un cliente.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/contabilidad/clientes-gestoria">Cartera de clientes</Link>
        </Button>
      </div>

      <div className="rounded-xl border border-sand-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="presentation-company">Empresa cliente</Label>
            <select
              id="presentation-company"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Seleccione una empresa…</option>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code} · {row.name} · {row.type}
                </option>
              ))}
            </select>
          </div>
          {selectedRow ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900">
              <Building2 className="h-4 w-4 shrink-0" />
              <span>
                {selectedRow.cif || "Sin NIF"} · {selectedRow.type}
              </span>
            </div>
          ) : null}
        </div>

        {profile && balanceLabel && pygLabel ? (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-sand-200 bg-sand-50 px-2.5 py-1 text-graphite-700">
              Balance: {balanceLabel}
            </span>
            <span className="rounded-full border border-sand-200 bg-sand-50 px-2.5 py-1 text-graphite-700">
              PyG: {pygLabel}
            </span>
            {profile.presentation.corporateTax.enabled ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">
                IS · Mod. 200
              </span>
            ) : null}
            {profile.presentation.model232Enabled ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">
                Mod. 232
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {savedMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {savedMessage}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-sand-200 bg-white py-20 text-emerald-800">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando configuración…
        </div>
      ) : profile ? (
        <>
          <GestoriaPresentationConfigForm
            entityType={clientEntityType}
            accountingPlanType={profile.accountingPlanType}
            presentation={profile.presentation}
            onAccountingPlanChange={handleAccountingPlanChange}
            onPresentationChange={handlePresentationChange}
          />

          <div className="flex justify-end border-t border-sand-200 pt-4">
            <Button
              type="button"
              className="bg-emerald-800 hover:bg-pine-900"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar configuración
                </>
              )}
            </Button>
          </div>
        </>
      ) : companyId ? null : (
        <div className="rounded-xl border border-dashed border-sand-300 bg-sand-50/50 px-6 py-16 text-center text-sm text-graphite-500">
          Seleccione una empresa de la cartera para configurar su plan contable y presentación
          fiscal.
        </div>
      )}
    </div>
  )
}

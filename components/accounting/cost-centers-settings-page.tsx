"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api-client"

interface CostCenter {
  id: string
  code: string
  name: string
  isActive: boolean
}

export function CostCentersSettingsPage() {
  const [analyticEnabled, setAnalyticEnabled] = useState(false)
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [settingsData, centersData] = await Promise.all([
        apiFetch<{ success: true; settings: { analyticAccountingEnabled: boolean } }>(
          "/api/accounting/analytic-settings",
        ),
        apiFetch<{ success: true; costCenters: CostCenter[] }>("/api/cost-centers"),
      ])
      setAnalyticEnabled(settingsData.settings.analyticAccountingEnabled)
      setCostCenters(centersData.costCenters)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la configuración.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const saveAnalyticSetting = async (enabled: boolean) => {
    setSaving(true)
    setMessage(null)
    try {
      await apiFetch("/api/accounting/analytic-settings", {
        method: "PUT",
        body: JSON.stringify({ analyticAccountingEnabled: enabled }),
      })
      setAnalyticEnabled(enabled)
      setMessage(enabled ? "Contabilidad analítica activada." : "Contabilidad analítica desactivada.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración.")
    } finally {
      setSaving(false)
    }
  }

  const createCostCenter = async () => {
    if (!code.trim() || !name.trim()) {
      setError("Indica código y nombre del centro de coste.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await apiFetch("/api/cost-centers", {
        method: "POST",
        body: JSON.stringify({ code: code.trim().toUpperCase(), name: name.trim() }),
      })
      setCode("")
      setName("")
      await loadData()
      setMessage("Centro de coste creado.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el centro de coste.")
    } finally {
      setSaving(false)
    }
  }

  const deactivateCostCenter = async (centerId: string) => {
    setSaving(true)
    setError(null)
    try {
      await apiFetch("/api/cost-centers", {
        method: "PATCH",
        body: JSON.stringify({ id: centerId, isActive: false }),
      })
      await loadData()
      setMessage("Centro de coste desactivado.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desactivar el centro.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-graphite-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando centros de coste…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contabilidad analítica</CardTitle>
          <CardDescription>
            Activa la distribución por centros de coste en cuentas de gastos e ingresos (grupos 6 y 7).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-graphite-800">Usar contabilidad analítica</p>
            <p className="text-xs text-graphite-500">
              Al introducir importes en cuentas 6/7 se solicitará la distribución analítica.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={analyticEnabled}
              disabled={saving}
              onChange={(event) => void saveAnalyticSetting(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="sr-only">Activar contabilidad analítica</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Centros de coste</CardTitle>
          <CardDescription>Define los centros para repartir gastos e ingresos (ej. CENTRO RUB, CENTRO SAB).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
            <div className="space-y-1">
              <Label htmlFor="cc-code">Código</Label>
              <Input
                id="cc-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="RUB"
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-name">Nombre / descripción</Label>
              <Input
                id="cc-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Centro Rubí"
              />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={() => void createCostCenter()} disabled={saving}>
                <Plus className="mr-2 h-4 w-4" />
                Alta
              </Button>
            </div>
          </div>

          <div className="divide-y rounded-lg border">
            {costCenters.length === 0 ? (
              <p className="px-4 py-6 text-sm text-graphite-500">No hay centros de coste registrados.</p>
            ) : (
              costCenters.map((center) => (
                <div key={center.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-emerald-900">{center.code}</p>
                    <p className="text-sm text-graphite-600">{center.name}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-red-600"
                    onClick={() => void deactivateCostCenter(center.id)}
                    disabled={saving || !center.isActive}
                    aria-label={`Desactivar ${center.code}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

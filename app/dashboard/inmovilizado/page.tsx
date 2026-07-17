"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { apiFetch } from "@/lib/api-client"
import type { FixedAssetInput, FixedAssetResponse } from "@/lib/types/extended-modules"
import { Building2, Loader2, Plus, Save } from "lucide-react"

interface CostCenter {
  id: string
  code: string
  name: string
}

const emptyForm: FixedAssetInput = {
  code: "",
  name: "",
  cuentaInmovilizado: "213",
  cuentaAmortAcumulada: "2813",
  cuentaGastoAmort: "6813",
  acquisitionDate: new Date().toISOString().split("T")[0],
  acquisitionCost: 0,
  residualValue: 0,
  usefulLifeMonths: 60,
  distributions: [],
}

export default function InmovilizadoPage() {
  const [assets, setAssets] = useState<FixedAssetResponse[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [form, setForm] = useState<FixedAssetInput>(emptyForm)
  const [selectedCenterId, setSelectedCenterId] = useState("")
  const [centerPct, setCenterPct] = useState("100")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [assetsData, centersData] = await Promise.all([
        apiFetch<{ success: true; assets: FixedAssetResponse[] }>("/api/fixed-assets"),
        apiFetch<{ success: true; costCenters: CostCenter[] }>("/api/cost-centers"),
      ])
      setAssets(assetsData.assets)
      setCostCenters(centersData.costCenters)
    } catch {
      setAssets([])
      setCostCenters([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const addDistribution = () => {
    if (!selectedCenterId) return
    const pct = Number.parseFloat(centerPct)
    if (!Number.isFinite(pct) || pct <= 0) return
    setForm((prev) => ({
      ...prev,
      distributions: [
        ...(prev.distributions ?? []).filter((d) => d.costCenterId !== selectedCenterId),
        { costCenterId: selectedCenterId, percentage: pct },
      ],
    }))
  }

  const handleCreate = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      await apiFetch("/api/fixed-assets", {
        method: "POST",
        body: JSON.stringify(form),
      })
      setForm(emptyForm)
      setMessage("Ficha de activo creada correctamente.")
      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el activo.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <Card className="overflow-hidden border-emerald-200">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-start gap-2 text-lg leading-snug text-emerald-900 sm:text-xl">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="break-words text-balance">Mantenimiento de Inmovilizado</span>
          </CardTitle>
          <CardDescription className="break-words text-pretty leading-relaxed">
            Edita fichas con cuentas 21x (inmovilizado), 281x (amortización acumulada) y 681x (gasto).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3">
          <Input placeholder="Código" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input placeholder="Nombre del activo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} />
          <Input placeholder="Cuenta 21x" value={form.cuentaInmovilizado} onChange={(e) => setForm({ ...form, cuentaInmovilizado: e.target.value })} />
          <Input placeholder="Cuenta 281x" value={form.cuentaAmortAcumulada} onChange={(e) => setForm({ ...form, cuentaAmortAcumulada: e.target.value })} />
          <Input placeholder="Cuenta 681x" value={form.cuentaGastoAmort} onChange={(e) => setForm({ ...form, cuentaGastoAmort: e.target.value })} />
          <Input type="number" placeholder="Coste adquisición" value={form.acquisitionCost || ""} onChange={(e) => setForm({ ...form, acquisitionCost: Number(e.target.value) })} />
          <Input type="number" placeholder="Valor residual" value={form.residualValue || ""} onChange={(e) => setForm({ ...form, residualValue: Number(e.target.value) })} />
          <Input type="number" placeholder="Vida útil (meses)" value={form.usefulLifeMonths || ""} onChange={(e) => setForm({ ...form, usefulLifeMonths: Number(e.target.value) })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base break-words">Distribución analítica — Centros de coste</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 px-4 sm:flex-row sm:flex-wrap sm:items-end sm:px-6">
          <select
            className="h-10 w-full rounded-md border px-3 text-sm sm:w-auto sm:min-w-[200px]"
            value={selectedCenterId}
            onChange={(e) => setSelectedCenterId(e.target.value)}
          >
            <option value="">Centro de coste</option>
            {costCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>
                {cc.code} — {cc.name}
              </option>
            ))}
          </select>
          <Input className="w-24" type="number" placeholder="%" value={centerPct} onChange={(e) => setCenterPct(e.target.value)} />
          <Button type="button" variant="outline" size="sm" onClick={addDistribution}>
            <Plus className="mr-1 h-4 w-4" />
            Añadir
          </Button>
          {(form.distributions ?? []).map((d) => {
            const cc = costCenters.find((c) => c.id === d.costCenterId)
            return (
              <span key={d.costCenterId} className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                {cc?.code} {d.percentage}%
              </span>
            )
          })}
        </CardContent>
      </Card>

      <Button onClick={handleCreate} disabled={isSaving} className="bg-emerald-700 hover:bg-emerald-800">
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Guardar ficha de activo
      </Button>

      {message && <p className="text-sm text-emerald-800">{message}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activos registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : assets.length === 0 ? (
            <p className="text-sm text-gray-500">No hay activos registrados.</p>
          ) : (
            <div className="space-y-3">
              {assets.map((asset) => (
                <div key={asset.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-semibold">
                    {asset.code} — {asset.name}
                  </p>
                  <p className="text-gray-500">
                    {asset.cuentaInmovilizado} / {asset.cuentaAmortAcumulada} / {asset.cuentaGastoAmort}
                  </p>
                  <p className="text-gray-600">
                    Coste: {asset.acquisitionCost.toFixed(2)} € · Amortizado: {asset.accumulatedAmort.toFixed(2)} €
                  </p>
                  {asset.distributions.length > 0 && (
                    <p className="text-xs text-emerald-700">
                      CC: {asset.distributions.map((d) => `${d.costCenterCode} ${d.percentage}%`).join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

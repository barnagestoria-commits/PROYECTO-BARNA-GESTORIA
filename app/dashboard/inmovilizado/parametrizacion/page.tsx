"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { apiFetch } from "@/lib/api-client"
import type { AmortizationPeriodization } from "@/lib/types/extended-modules"
import { Calculator, Loader2, Settings2 } from "lucide-react"

export default function ParametrizacionPage() {
  const [periodization, setPeriodization] = useState<AmortizationPeriodization>("TRIMESTRAL")
  const [newCenterCode, setNewCenterCode] = useState("")
  const [newCenterName, setNewCenterName] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await apiFetch<{ success: true; settings: { periodization: AmortizationPeriodization } }>(
        "/api/amortization/settings",
      )
      setPeriodization(data.settings.periodization)
    } catch {
      setPeriodization("TRIMESTRAL")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const saveSettings = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      await apiFetch("/api/amortization/settings", {
        method: "PUT",
        body: JSON.stringify({ periodization }),
      })
      setMessage("Parametrización guardada.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al guardar.")
    } finally {
      setIsSaving(false)
    }
  }

  const generateAmortizations = async () => {
    setIsGenerating(true)
    setMessage(null)
    try {
      const data = await apiFetch<{
        success: true
        result: { message: string; totalAmount: number; periodLabel: string }
      }>("/api/amortization/generate", { method: "POST" })
      setMessage(`${data.result.message} Total: ${data.result.totalAmount.toFixed(2)} €`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron generar las amortizaciones.")
    } finally {
      setIsGenerating(false)
    }
  }

  const createCostCenter = async () => {
    if (!newCenterCode.trim() || !newCenterName.trim()) return
    try {
      await apiFetch("/api/cost-centers", {
        method: "POST",
        body: JSON.stringify({ code: newCenterCode, name: newCenterName }),
      })
      setNewCenterCode("")
      setNewCenterName("")
      setMessage("Centro de coste creado.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al crear centro de coste.")
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-900">
            <Settings2 className="h-5 w-5" />
            Parametrización de amortizaciones
          </CardTitle>
          <CardDescription>Define la periodificación del cálculo de amortizaciones.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(["MENSUAL", "TRIMESTRAL", "ANUAL"] as const).map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={periodization === option ? "default" : "outline"}
                  size="sm"
                  className={periodization === option ? "bg-emerald-700 hover:bg-emerald-800" : ""}
                  onClick={() => setPeriodization(option)}
                >
                  {option === "MENSUAL" ? "Mensual" : option === "TRIMESTRAL" ? "Trimestral" : "Anual"}
                </Button>
              ))}
            </div>
          )}
          <Button onClick={saveSettings} disabled={isSaving} variant="outline" size="sm">
            Guardar parametrización
          </Button>
        </CardContent>
      </Card>

      <Card id="generar">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-5 w-5" />
            Generar amortizaciones del periodo
          </CardTitle>
          <CardDescription>
            Crea manualmente el asiento de amortización del periodo según la parametrización activa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={generateAmortizations}
            disabled={isGenerating}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generar amortizaciones del periodo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Centros de coste</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input placeholder="Código CC" value={newCenterCode} onChange={(e) => setNewCenterCode(e.target.value)} className="w-32" />
          <Input placeholder="Nombre" value={newCenterName} onChange={(e) => setNewCenterName(e.target.value)} className="w-48" />
          <Button variant="outline" size="sm" onClick={createCostCenter}>
            Crear centro
          </Button>
        </CardContent>
      </Card>

      {message && <p className="text-sm text-emerald-800">{message}</p>}
    </div>
  )
}

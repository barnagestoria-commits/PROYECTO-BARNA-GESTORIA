"use client"

import { useCallback, useEffect, useState } from "react"
import { Eye, Loader2, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useRequireAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api-client"
import { createDefaultInvoiceTemplate } from "@/lib/invoices/invoice-template-defaults"
import type { InvoiceTableStyle, InvoiceTemplateConfig } from "@/lib/invoices/types"
import { createDefaultInvoiceDetails } from "@/lib/types/invoice-entry-details"

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-sand-200 bg-white px-4 py-3">
      <span>
        <span className="block text-sm font-medium text-graphite-800">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-graphite-500">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-sand-300"
      />
    </label>
  )
}

export function InvoiceTemplateDesigner() {
  const { activeCompany } = useRequireAuth()
  const [template, setTemplate] = useState<InvoiceTemplateConfig>(createDefaultInvoiceTemplate())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const result = await apiFetch<{ success: true; data: InvoiceTemplateConfig }>(
          "/api/invoices/template",
        )
        if (!cancelled) setTemplate(result.data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar plantilla.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [activeCompany?.id])

  const updateVisibility = (key: keyof InvoiceTemplateConfig["visibility"], value: boolean) => {
    setTemplate((current) => ({
      ...current,
      visibility: { ...current.visibility, [key]: value },
    }))
  }

  const handleLogoUpload = useCallback((file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setTemplate((current) => ({ ...current, logoDataUrl: String(reader.result) }))
    }
    reader.readAsDataURL(file)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const result = await apiFetch<{ success: true; data: InvoiceTemplateConfig }>(
        "/api/invoices/template",
        { method: "PUT", body: JSON.stringify(template) },
      )
      setTemplate(result.data)
      setMessage("Plantilla guardada correctamente.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la plantilla.")
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async () => {
    setPreviewing(true)
    setError(null)
    try {
      const sample = createDefaultInvoiceDetails(new Date().toISOString().slice(0, 10))
      sample.invoiceNumber = "F-2026-001"
      sample.thirdPartyName = "Cliente de ejemplo S.L."
      sample.nif = "B12345678"
      sample.vatLines[0] = { ...sample.vatLines[0], base: 1000, quota: 210, vatPercent: 21 }

      const response = await fetch("/api/invoices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          template,
          invoice: sample,
          lineDescriptions: ["Servicios profesionales de gestoría"],
          verifactuHash: "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855",
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? "Error al generar la previsualización.")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank", "noopener,noreferrer")
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo previsualizar la factura.")
    } finally {
      setPreviewing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-graphite-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando plantilla…
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-sand-200">
        <CardHeader>
          <CardTitle className="text-pine-900">Diseño visual</CardTitle>
          <CardDescription>
            Personaliza la factura emitida al estilo Holded: colores, logo, tabla y bloques visibles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-graphite-600">Color corporativo</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={template.primaryColor}
                  onChange={(e) => setTemplate({ ...template, primaryColor: e.target.value })}
                  className="h-10 w-16 cursor-pointer p-1"
                />
                <Input
                  value={template.primaryColor}
                  onChange={(e) => setTemplate({ ...template, primaryColor: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-graphite-600">Color acento</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={template.accentColor}
                  onChange={(e) => setTemplate({ ...template, accentColor: e.target.value })}
                  className="h-10 w-16 cursor-pointer p-1"
                />
                <Input
                  value={template.accentColor}
                  onChange={(e) => setTemplate({ ...template, accentColor: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-graphite-600">Logo de empresa</Label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-sand-300 px-3 py-2 text-sm text-graphite-700 hover:bg-sand-50">
                <Upload className="h-4 w-4" />
                Subir logo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
                />
              </label>
              {template.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={template.logoDataUrl} alt="Logo" className="h-10 max-w-[140px] object-contain" />
              ) : null}
              {template.logoDataUrl ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setTemplate({ ...template, logoDataUrl: null })}>
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-graphite-600">Estilo de tabla de conceptos</Label>
            <select
              value={template.tableStyle}
              onChange={(e) => setTemplate({ ...template, tableStyle: e.target.value as InvoiceTableStyle })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="striped">Rayada (Holded clásico)</option>
              <option value="classic">Cabecera sólida</option>
              <option value="minimal">Minimalista</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-graphite-600">Plazo de pago (días)</Label>
              <Input
                type="number"
                min={0}
                value={template.paymentTermsDays}
                onChange={(e) =>
                  setTemplate({ ...template, paymentTermsDays: Number.parseInt(e.target.value, 10) || 0 })
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-graphite-600">Notas legales del pie</Label>
            <Textarea
              rows={3}
              value={template.footerNotes}
              onChange={(e) => setTemplate({ ...template, footerNotes: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-sand-200">
          <CardHeader>
            <CardTitle className="text-base text-pine-900">Visibilidad de bloques</CardTitle>
            <CardDescription>Activa o oculta secciones en el PDF generado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ToggleRow
              label="Vencimientos"
              description="Muestra la fecha de vencimiento calculada según el plazo de pago."
              checked={template.visibility.showDueDates}
              onChange={(value) => updateVisibility("showDueDates", value)}
            />
            <ToggleRow
              label="Notas del pie"
              description="Incluye el texto legal configurado en la plantilla."
              checked={template.visibility.showFooterNotes}
              onChange={(value) => updateVisibility("showFooterNotes", value)}
            />
            <ToggleRow
              label="Descuentos al 0 %"
              description="Muestra la columna de descuento aunque sea cero."
              checked={template.visibility.showZeroDiscounts}
              onChange={(value) => updateVisibility("showZeroDiscounts", value)}
            />
            <ToggleRow
              label="IBAN / datos bancarios"
              description="Bloque de pago con la cuenta bancaria principal de la empresa."
              checked={template.visibility.showIban}
              onChange={(value) => updateVisibility("showIban", value)}
            />
            <ToggleRow
              label="Registro Mercantil"
              description="Solo para sociedades mercantiles con datos completados en la ficha."
              checked={template.visibility.showRegistroMercantil}
              onChange={(value) => updateVisibility("showRegistroMercantil", value)}
            />
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader>
            <CardTitle className="text-base text-pine-900">Veri*factu</CardTitle>
            <CardDescription>
              El PDF incluye QR de cotejo AEAT con NIF, número, fecha, importe y huella del registro.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-graphite-700">
            <p>El entorno (Sandbox / Producción) se toma del certificado digital configurado.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handlePreview} disabled={previewing}>
                {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                Previsualizar PDF
              </Button>
              <Button type="button" variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar plantilla
              </Button>
            </div>
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

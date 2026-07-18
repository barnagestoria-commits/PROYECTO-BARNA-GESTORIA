"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FiscalExportButtons } from "@/components/report-export-buttons"
import { apiFetch } from "@/lib/api-client"
import { formatFiscalAmount } from "@/lib/fiscal/panorama"
import {
  ANNUAL_SUMMARY_MODELS,
  CLIENT_PROFILE_OPTIONS,
  FISCAL_MODEL_OPTIONS,
  settingsKeyForModel,
  type CompanyFiscalSettingsDto,
} from "@/lib/fiscal/fiscal-settings"
import { downloadFiscalBundleZip } from "@/lib/reports/download-client"
import type { FiscalModelId } from "@/lib/types/fiscal-panorama"
import { ArrowRight, Loader2, Save, Scale, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface TaxSummaryPanelProps {
  companyId: string | null | undefined
}

interface ResumenPayload {
  year: number
  quarter: number
  periodLabel: string
  totalAPagarDevolver: number
  resultLabel: string
}

export function TaxSummaryPanel({ companyId }: TaxSummaryPanelProps) {
  const currentYear = new Date().getFullYear()
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3)
  const [data, setData] = useState<ResumenPayload | null>(null)
  const [settings, setSettings] = useState<CompanyFiscalSettingsDto | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [bundleLoading, setBundleLoading] = useState<"annual" | "trimestral" | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadPanel = useCallback(async () => {
    if (!companyId) return

    setIsLoading(true)
    try {
      const [resumenRes, settingsRes] = await Promise.all([
        apiFetch<{ success: true; resumen: ResumenPayload }>(
          `/api/fiscal/resumen/${currentYear}/${currentQuarter}`,
        ),
        apiFetch<{ success: true; settings: CompanyFiscalSettingsDto }>("/api/fiscal/settings"),
      ])
      setData(resumenRes.resumen)
      setSettings(settingsRes.settings)
    } catch {
      setData(null)
      setSettings(null)
    } finally {
      setIsLoading(false)
    }
  }, [companyId, currentYear, currentQuarter])

  useEffect(() => {
    loadPanel()
  }, [loadPanel])

  if (!companyId) return null

  const amount = data?.totalAPagarDevolver ?? 0
  const isPositive = amount > 0
  const isNegative = amount < 0

  const enabledModels = settings
    ? FISCAL_MODEL_OPTIONS.filter((model) => settings[settingsKeyForModel(model.id)])
    : []

  const applyProfile = async (profile: CompanyFiscalSettingsDto["clientProfile"]) => {
    setIsSaving(true)
    setMessage(null)
    try {
      const res = await apiFetch<{ success: true; settings: CompanyFiscalSettingsDto }>(
        "/api/fiscal/settings",
        { method: "PATCH", body: JSON.stringify({ applyProfile: profile }) },
      )
      setSettings(res.settings)
      setMessage("Perfil fiscal aplicado.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la configuración.")
    } finally {
      setIsSaving(false)
    }
  }

  const toggleModel = async (model: FiscalModelId, enabled: boolean) => {
    if (!settings) return
    setIsSaving(true)
    setMessage(null)
    try {
      const res = await apiFetch<{ success: true; settings: CompanyFiscalSettingsDto }>(
        "/api/fiscal/settings",
        {
          method: "PATCH",
          body: JSON.stringify({ [settingsKeyForModel(model)]: enabled }),
        },
      )
      setSettings(res.settings)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el modelo.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleBundle = async (scope: "annual" | "trimestral") => {
    setBundleLoading(scope)
    setMessage(null)
    try {
      await downloadFiscalBundleZip(currentYear, scope)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo generar el paquete ZIP.")
    } finally {
      setBundleLoading(null)
    }
  }

  return (
    <Card
      data-tour="pagar-devolver"
      className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white"
    >
      <CardHeader className="px-4 pb-2 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-start gap-2 text-base leading-snug text-emerald-900">
              <Scale className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="break-words">A pagar / devolver</span>
            </CardTitle>
            <CardDescription className="break-words text-pretty">
              IVA (472/477) + retenciones del trimestre en curso
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-emerald-300"
            onClick={() => setShowConfig((value) => !value)}
          >
            <Settings2 className="h-4 w-4" />
            Configuración fiscal
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-4 sm:px-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculando saldo fiscal…
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div>
              <p
                className={cn(
                  "font-mono text-3xl font-bold tabular-nums",
                  isPositive && "text-red-700",
                  isNegative && "text-blue-700",
                  !isPositive && !isNegative && "text-gray-500",
                )}
              >
                {formatFiscalAmount(amount)}
              </p>
              <p className="mt-1 text-sm font-medium text-emerald-800">
                {data?.resultLabel ?? "Sin resultado"}
                {data?.periodLabel ? ` · ${data.periodLabel}` : ""}
              </p>
            </div>

            <Button variant="outline" size="sm" asChild className="border-emerald-300 text-emerald-800">
              <Link href={`/dashboard/fiscal/pagar-devolver/${currentYear}/${currentQuarter}`}>
                Ver desglose
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}

        {showConfig && settings && (
          <div className="space-y-4 rounded-xl border border-emerald-200 bg-white/80 p-4">
            <div>
              <p className="text-sm font-semibold text-emerald-900">Tipo de cliente</p>
              <p className="mt-1 text-xs text-gray-500">
                Activa los modelos habituales según el perfil fiscal del cliente.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {CLIENT_PROFILE_OPTIONS.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    disabled={isSaving}
                    onClick={() => applyProfile(profile.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors",
                      settings.clientProfile === profile.id
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40",
                    )}
                  >
                    <span className="block text-sm font-semibold text-gray-900">{profile.label}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">{profile.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-emerald-900">Modelos habilitados</p>
              <div className="mt-3 space-y-2">
                {FISCAL_MODEL_OPTIONS.map((model) => {
                  const enabled = settings[settingsKeyForModel(model.id)]
                  return (
                    <label
                      key={model.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={isSaving}
                        onChange={(event) => toggleModel(model.id, event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-700"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{model.label}</span>
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {model.periodicity}
                          </Badge>
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500">{model.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-emerald-900">
                Exportación {currentQuarter}T {currentYear}
              </p>
              {enabledModels
                .filter((model) => model.periodicity === "trimestral")
                .map((model) => (
                  <div key={model.id} className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                    <p className="mb-2 text-sm font-medium text-emerald-900">
                      {model.label} · {currentQuarter}T
                    </p>
                    <FiscalExportButtons
                      model={model.id}
                      quarter={currentQuarter}
                      year={currentYear}
                      compact
                    />
                  </div>
                ))}

              <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                <p className="mb-2 text-sm font-medium text-emerald-900">Resúmenes anuales habilitados</p>
                <div className="space-y-3">
                  {ANNUAL_SUMMARY_MODELS.filter((modelId) => settings[settingsKeyForModel(modelId)]).map(
                    (modelId) => {
                      const model = FISCAL_MODEL_OPTIONS.find((item) => item.id === modelId)!
                      return (
                        <div key={modelId}>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                            {model.label}
                          </p>
                          <FiscalExportButtons
                            model={modelId}
                            quarter="anual"
                            year={currentYear}
                            compact
                          />
                        </div>
                      )
                    },
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!bundleLoading}
                  className="gap-2 border-emerald-300"
                  onClick={() => handleBundle("trimestral")}
                >
                  {bundleLoading === "trimestral" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  ZIP trimestral (.txt incluido)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!bundleLoading}
                  className="gap-2 border-emerald-300"
                  onClick={() => handleBundle("annual")}
                >
                  {bundleLoading === "annual" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  ZIP anual completo
                </Button>
              </div>
            </div>
          </div>
        )}

        {message && <p className="text-sm text-emerald-800">{message}</p>}
      </CardContent>
    </Card>
  )
}

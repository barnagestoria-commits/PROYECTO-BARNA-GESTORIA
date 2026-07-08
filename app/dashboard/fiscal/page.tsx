"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FiscalPanoramaMatrix } from "@/components/fiscal-panorama-matrix"
import { CompanySelector } from "@/components/company-selector"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { useRequireAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api-client"
import type { FiscalPanoramaResponse } from "@/lib/types/fiscal-panorama"
import { ArrowLeft, CalendarRange, Loader2, LogOut, TableProperties } from "lucide-react"

export default function FiscalPanoramaPage() {
  const { session, panelTitle, roleLabel, activeCompany, logout, isLoading } = useRequireAuth()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [panorama, setPanorama] = useState<FiscalPanoramaResponse | null>(null)
  const [isLoadingPanorama, setIsLoadingPanorama] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPanorama = useCallback(async () => {
    if (!session?.activeCompanyId) return

    setIsLoadingPanorama(true)
    setError(null)
    try {
      const data = await apiFetch<{ success: true; panorama: FiscalPanoramaResponse }>(
        `/api/fiscal/panorama?year=${year}`,
      )
      setPanorama(data.panorama)
    } catch (err) {
      setPanorama(null)
      setError(err instanceof Error ? err.message : "No se pudo cargar la vista panorámica.")
    } finally {
      setIsLoadingPanorama(false)
    }
  }, [session?.activeCompanyId, year])

  useEffect(() => {
    if (session?.activeCompanyId) {
      loadPanorama()
    }
  }, [session?.activeCompanyId, loadPanorama])

  if (isLoading || !session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <ResponsiveLogo size="sm" />
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-emerald-800">
                Vista Panorámica Fiscal — {panelTitle}
              </h1>
              <p className="text-xs text-gray-500">
                {session.user.name} • {roleLabel}
                {activeCompany && ` • ${activeCompany.name}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CompanySelector />
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Documentos
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6">
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <TableProperties className="h-5 w-5" />
              Mantenimiento de datos — Resumen periódico
            </CardTitle>
            <CardDescription>
              Matriz trimestral calculada desde los asientos contables de la empresa activa. Estilo A3eco:
              verde/azul si presentado, rojo (SD/Pendiente) si falta cerrar el periodo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-gray-500" />
              <label htmlFor="fiscal-year" className="text-sm font-medium">
                Ejercicio
              </label>
              <select
                id="fiscal-year"
                value={year}
                onChange={(e) => setYear(Number.parseInt(e.target.value, 10))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
              <span className="rounded border border-emerald-300 bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
                Presentado
              </span>
              <span className="rounded border border-red-300 bg-red-100 px-2 py-1 font-semibold text-red-800">
                Pendiente / SD
              </span>
            </div>
          </CardContent>
        </Card>

        {!activeCompany ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-600">
              Selecciona una empresa para ver la vista panorámica fiscal.
            </CardContent>
          </Card>
        ) : isLoadingPanorama ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Calculando modelos fiscales…
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-red-700">{error}</CardContent>
          </Card>
        ) : panorama ? (
          <FiscalPanoramaMatrix panorama={panorama} />
        ) : null}
      </div>
    </div>
  )
}

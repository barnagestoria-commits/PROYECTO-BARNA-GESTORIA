"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRequireAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api-client"
import { formatFiscalAmount } from "@/lib/fiscal/panorama"
import type { FiscalPanoramaResponse } from "@/lib/types/fiscal-panorama"
import { ArrowLeft, Loader2, Scale } from "lucide-react"

export default function FiscalSummaryDetailPage() {
  const params = useParams<{ year: string; quarter: string }>()
  const { session } = useRequireAuth()
  const [panorama, setPanorama] = useState<FiscalPanoramaResponse | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const periodKey =
    params.quarter === "anual" ? "annual" : (`q${params.quarter}` as "q1" | "q2" | "q3" | "q4")

  const loadData = useCallback(async () => {
    if (!session?.activeCompanyId || !params.year) return

    setIsLoadingData(true)
    setError(null)
    try {
      const data = await apiFetch<{ success: true; panorama: FiscalPanoramaResponse }>(
        `/api/fiscal/panorama?year=${params.year}`,
      )
      setPanorama(data.panorama)
    } catch (err) {
      setPanorama(null)
      setError(err instanceof Error ? err.message : "No se pudo cargar el resumen.")
    } finally {
      setIsLoadingData(false)
    }
  }, [session?.activeCompanyId, params.year])

  useEffect(() => {
    if (session?.activeCompanyId) {
      loadData()
    }
  }, [session?.activeCompanyId, loadData])

  const summaryCell = panorama?.summary.cells[periodKey]

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard/fiscal">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Panorámica fiscal
        </Link>
      </Button>

      {isLoadingData ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando resumen…
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-red-700">{error}</CardContent>
        </Card>
      ) : panorama && summaryCell ? (
        <>
          <Card className="border-emerald-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-900">
                <Scale className="h-5 w-5" />
                {panorama.summary.label}
              </CardTitle>
              <CardDescription>
                Ejercicio {params.year} — {params.quarter === "anual" ? "Resumen anual" : `${params.quarter}T`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-mono font-semibold tabular-nums">
                {formatFiscalAmount(summaryCell.amount)}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {panorama.blocks.flatMap((block) =>
              block.rows.map((row) => (
                <Card key={row.modelCode}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{row.modelLabel}</CardTitle>
                    <CardDescription>{block.label}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <span className="font-mono text-lg tabular-nums">
                      {formatFiscalAmount(row.cells[periodKey].amount)}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={row.cells[periodKey].href}>Ver desglose</Link>
                    </Button>
                  </CardContent>
                </Card>
              )),
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { apiFetch } from "@/lib/api-client"
import { formatFiscalAmount } from "@/lib/fiscal/panorama"
import { ArrowLeft, Loader2, Scale } from "lucide-react"

interface ResumenData {
  year: number
  quarter: number | "annual"
  periodLabel: string
  summary: {
    ivaResult: number
    retenciones111: number
    retenciones115: number
    retenciones180: number
    totalAPagarDevolver: number
    resultLabel: string
  }
  models: Array<{ modelCode: string; modelLabel: string; amount: number; href: string }>
  totalAPagarDevolver: number
  resultLabel: string
}

export default function PagarDevolverPage() {
  const params = useParams<{ year?: string; quarter?: string }>()
  const router = useRouter()
  const year = params.year ? Number.parseInt(params.year, 10) : new Date().getFullYear()
  const quarter = params.quarter ?? String(Math.ceil((new Date().getMonth() + 1) / 3))
  const [data, setData] = useState<ResumenData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadResumen = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ success: true; resumen: ResumenData }>(
        `/api/fiscal/resumen/${year}/${quarter}`,
      )
      setData(res.resumen)
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : "No se pudo cargar el resumen.")
    } finally {
      setIsLoading(false)
    }
  }, [year, quarter])

  useEffect(() => {
    if (params.year) loadResumen()
  }, [params.year, loadResumen])

  if (!params.year) {
    const currentYear = new Date().getFullYear()
    const currentQ = Math.ceil((new Date().getMonth() + 1) / 3)
    router.replace(`/dashboard/fiscal/pagar-devolver/${currentYear}/${currentQ}`)
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/fiscal">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Panorámica
          </Link>
        </Button>
        <select
          className="h-9 rounded-md border px-3 text-sm"
          value={quarter}
          onChange={(e) => router.push(`/dashboard/fiscal/pagar-devolver/${year}/${e.target.value}`)}
        >
          <option value="1">1T</option>
          <option value="2">2T</option>
          <option value="3">3T</option>
          <option value="4">4T</option>
          <option value="anual">Anual</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Calculando resultado fiscal…
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-red-700">{error}</CardContent>
        </Card>
      ) : data ? (
        <>
          <Card className="border-emerald-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-900">
                <Scale className="h-5 w-5" />
                A pagar / devolver — {data.periodLabel}
              </CardTitle>
              <CardDescription>
                IVA (cuentas 472/477) combinado con retenciones IRPF (111, 115 y 180).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-mono font-bold tabular-nums">
                {formatFiscalAmount(data.totalAPagarDevolver)}
              </p>
              <p className="mt-1 text-sm font-medium text-emerald-700">{data.resultLabel}</p>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">IVA (Mod. 303)</CardTitle>
              </CardHeader>
              <CardContent className="font-mono tabular-nums">
                {formatFiscalAmount(data.summary.ivaResult)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Retenciones Mod. 111</CardTitle>
              </CardHeader>
              <CardContent className="font-mono tabular-nums">
                {formatFiscalAmount(data.summary.retenciones111)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Retenciones Mod. 115</CardTitle>
              </CardHeader>
              <CardContent className="font-mono tabular-nums">
                {formatFiscalAmount(data.summary.retenciones115)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Retenciones Mod. 180 (4751)</CardTitle>
              </CardHeader>
              <CardContent className="font-mono tabular-nums">
                {formatFiscalAmount(data.summary.retenciones180)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desglose por modelo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.models.map((model) => (
                <div key={model.modelCode} className="flex items-center justify-between text-sm">
                  <Link href={model.href} className="text-emerald-800 hover:underline">
                    {model.modelLabel}
                  </Link>
                  <span className="font-mono tabular-nums">{formatFiscalAmount(model.amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

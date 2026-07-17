"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api-client"
import { formatFiscalAmount } from "@/lib/fiscal/panorama"
import { ArrowRight, Loader2, Scale } from "lucide-react"
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
  const [isLoading, setIsLoading] = useState(false)

  const loadSummary = useCallback(async () => {
    if (!companyId) return

    setIsLoading(true)
    try {
      const res = await apiFetch<{ success: true; resumen: ResumenPayload }>(
        `/api/fiscal/resumen/${currentYear}/${currentQuarter}`,
      )
      setData(res.resumen)
    } catch {
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [companyId, currentYear, currentQuarter])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  if (!companyId) return null

  const amount = data?.totalAPagarDevolver ?? 0
  const isPositive = amount > 0
  const isNegative = amount < 0

  return (
    <Card
      data-tour="pagar-devolver"
      className="border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white"
    >
      <CardHeader className="px-4 pb-2 sm:px-6">
        <CardTitle className="flex items-start gap-2 text-base leading-snug text-emerald-900">
          <Scale className="mt-0.5 h-5 w-5 shrink-0" />
          <span className="break-words">A pagar / devolver</span>
        </CardTitle>
        <CardDescription className="break-words text-pretty">
          IVA (472/477) + retenciones del trimestre en curso
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:px-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculando saldo fiscal…
          </div>
        ) : (
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
        )}

        <Button variant="outline" size="sm" asChild className="border-emerald-300 text-emerald-800">
          <Link href={`/dashboard/fiscal/pagar-devolver/${currentYear}/${currentQuarter}`}>
            Ver desglose
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

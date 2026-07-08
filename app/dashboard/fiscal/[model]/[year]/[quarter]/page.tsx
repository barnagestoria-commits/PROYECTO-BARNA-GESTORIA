"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useRequireAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api-client"
import { formatFiscalAmount } from "@/lib/fiscal/panorama"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import { ArrowLeft, FileSpreadsheet, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

function statusBadgeClass(status: FiscalModelDetailResponse["status"]): string {
  switch (status) {
    case "presentado":
      return "border-emerald-300 bg-emerald-100 text-emerald-800"
    case "pendiente":
      return "border-red-300 bg-red-100 text-red-800"
    case "sin_datos":
      return "border-red-300 bg-red-50 text-red-700"
  }
}

export default function FiscalModelDetailPage() {
  const params = useParams<{ model: string; year: string; quarter: string }>()
  const { session } = useRequireAuth()
  const [detail, setDetail] = useState<FiscalModelDetailResponse | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDetail = useCallback(async () => {
    if (!session?.activeCompanyId || !params.model || !params.year || !params.quarter) return

    setIsLoadingDetail(true)
    setError(null)
    try {
      const data = await apiFetch<{ success: true; detail: FiscalModelDetailResponse }>(
        `/api/fiscal/models/${params.model}/${params.year}/${params.quarter}`,
      )
      setDetail(data.detail)
    } catch (err) {
      setDetail(null)
      setError(err instanceof Error ? err.message : "No se pudo cargar el desglose.")
    } finally {
      setIsLoadingDetail(false)
    }
  }, [session?.activeCompanyId, params.model, params.year, params.quarter])

  useEffect(() => {
    if (session?.activeCompanyId) {
      loadDetail()
    }
  }, [session?.activeCompanyId, loadDetail])

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/dashboard/fiscal/${params.model}`}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver al modelo
        </Link>
      </Button>

      {isLoadingDetail ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando desglose…
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-red-700">{error}</CardContent>
        </Card>
      ) : detail ? (
        <>
          <Card className="border-emerald-200">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-emerald-900">
                    <FileSpreadsheet className="h-5 w-5" />
                    {detail.modelLabel}
                  </CardTitle>
                  <CardDescription>{detail.periodLabel}</CardDescription>
                </div>
                <Badge variant="outline" className={cn("font-bold uppercase", statusBadgeClass(detail.status))}>
                  {detail.statusLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-mono font-semibold tabular-nums text-gray-900">
                {formatFiscalAmount(detail.amount)}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Importe calculado desde los asientos contables del periodo.
              </p>
            </CardContent>
          </Card>

          {detail.breakdown.map((section) => (
            <Card key={section.key}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{section.label}</CardTitle>
                <CardDescription className="font-mono tabular-nums">
                  Total: {formatFiscalAmount(section.total)}
                </CardDescription>
              </CardHeader>
              {section.lines.length > 0 ? (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Cuenta</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead className="text-right">Debe</TableHead>
                        <TableHead className="text-right">Haber</TableHead>
                        <TableHead className="text-right">Importe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {section.lines.map((line) => (
                        <TableRow key={line.lineId}>
                          <TableCell>{line.entryDate}</TableCell>
                          <TableCell className="font-mono">{line.cuenta}</TableCell>
                          <TableCell>{line.concepto || "—"}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {line.debe ? formatFiscalAmount(line.debe) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {line.haber ? formatFiscalAmount(line.haber) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold tabular-nums">
                            {formatFiscalAmount(line.signedAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              ) : (
                <CardContent className="text-sm text-gray-500">Sin movimientos en esta sección.</CardContent>
              )}
            </Card>
          ))}
        </>
      ) : null}
    </div>
  )
}

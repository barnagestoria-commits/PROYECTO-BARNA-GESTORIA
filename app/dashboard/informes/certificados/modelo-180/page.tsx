"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiFetch } from "@/lib/api-client"
import { formatFiscalAmount } from "@/lib/fiscal/panorama"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import { FiscalExportButtons } from "@/components/report-export-buttons"
import { FileSpreadsheet, Loader2 } from "lucide-react"

export default function CertificadoModelo180Page() {
  const year = new Date().getFullYear()
  const [detail, setDetail] = useState<FiscalModelDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadDetail = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await apiFetch<{ success: true; detail: FiscalModelDetailResponse }>(
        `/api/fiscal/models/180/${year}/anual`,
      )
      setDetail(data.detail)
    } catch {
      setDetail(null)
    } finally {
      setIsLoading(false)
    }
  }, [year])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  const lines = detail?.breakdown.flatMap((section) => section.lines) ?? []

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-900">
            <FileSpreadsheet className="h-5 w-5" />
            Certificados / Retenciones — Modelo 180
          </CardTitle>
          <CardDescription>
            Acumulación en tiempo real de retenciones de alquileres (cuenta 4751) del ejercicio {year}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : detail ? (
            <div className="space-y-2">
              <p className="text-2xl font-mono font-semibold tabular-nums">
                {formatFiscalAmount(detail.amount)}
              </p>
              <p className="text-sm text-gray-500">{lines.length} movimientos en 4751</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Sin datos de retenciones de alquileres.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-emerald-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-emerald-900">Exportar certificados Mod. 180</CardTitle>
          <CardDescription>PDF, Excel, CSV o ZIP para Hacienda y registro mercantil.</CardDescription>
        </CardHeader>
        <CardContent>
          <FiscalExportButtons model="180" quarter="anual" year={year} disabled={!detail} />
        </CardContent>
      </Card>

      {lines.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.lineId}>
                    <TableCell>{line.entryDate}</TableCell>
                    <TableCell className="font-mono">{line.cuenta}</TableCell>
                    <TableCell>{line.concepto || "—"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatFiscalAmount(line.signedAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Button variant="outline" asChild>
        <Link href="/dashboard/fiscal/180">Ver modelo 180 completo</Link>
      </Button>
    </div>
  )
}

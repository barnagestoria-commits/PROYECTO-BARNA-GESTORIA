"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FISCAL_MODEL_DEFINITIONS } from "@/lib/fiscal/panorama"
import type { FiscalModelId } from "@/lib/types/fiscal-panorama"
import { ArrowRight, FileSpreadsheet } from "lucide-react"

const VALID_MODELS = new Set(["111", "115", "180", "303"])

export default function FiscalModelHubPage() {
  const params = useParams<{ model: string }>()
  const year = new Date().getFullYear()
  const modelCode = params.model as FiscalModelId

  const model = FISCAL_MODEL_DEFINITIONS.find((item) => item.code === modelCode)
  const isAnnualOnly = modelCode === "180"

  if (!model || !VALID_MODELS.has(modelCode)) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-gray-600">Modelo fiscal no encontrado.</CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-900">
            <FileSpreadsheet className="h-5 w-5" />
            {model.label}
          </CardTitle>
          <CardDescription>{model.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/fiscal">Ver panorámica completa</Link>
          </Button>
        </CardContent>
      </Card>

      {!isAnnualOnly ? (
        <>
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-800">
              Presentación trimestral (.txt Hacienda)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {([1, 2, 3, 4] as const).map((quarter) => (
                <Link
                  key={quarter}
                  href={`/dashboard/fiscal/${modelCode}/${year}/${quarter}`}
                  className="group rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50/50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{quarter}T {year}</p>
                      <p className="text-sm text-gray-500">Borrador, exportación .txt y desglose</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <Link
            href={`/dashboard/fiscal/${modelCode}/${year}/anual`}
            className="group block rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 transition-colors hover:bg-emerald-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-emerald-900">Resumen anual acumulado {year}</p>
                <p className="text-sm text-emerald-700/80">Totales del ejercicio (PDF, Excel, CSV, ZIP)</p>
              </div>
              <ArrowRight className="h-4 w-4 text-emerald-600 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        </>
      ) : (
        <Link
          href={`/dashboard/fiscal/${modelCode}/${year}/anual`}
          className="group block rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 transition-colors hover:bg-emerald-50"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-emerald-900">Resumen anual {year}</p>
              <p className="text-sm text-emerald-700/80">Modelo 180 — certificados y exportación .txt anual</p>
            </div>
            <ArrowRight className="h-4 w-4 text-emerald-600 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
      )}
    </div>
  )
}

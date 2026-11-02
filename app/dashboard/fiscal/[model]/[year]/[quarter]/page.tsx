"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useRequireAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api-client"
import { FiscalModelDraftView } from "@/components/fiscal/fiscal-model-draft-view"
import { DRAFT_SUPPORTED_MODELS } from "@/lib/fiscal/model-draft/types"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import { ArrowLeft, Loader2 } from "lucide-react"

interface FiscalModelDetailPageState {
  detail: FiscalModelDetailResponse
  companyName: string
  companyCif: string | null
}

export default function FiscalModelDetailPage() {
  const params = useParams<{ model: string; year: string; quarter: string }>()
  const { session, activeCompany } = useRequireAuth()
  const [payload, setPayload] = useState<FiscalModelDetailPageState | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDetail = useCallback(async () => {
    if (!session?.activeCompanyId || !params.model || !params.year || !params.quarter) return

    setIsLoadingDetail(true)
    setError(null)
    try {
      const data = await apiFetch<{
        success: true
        detail: FiscalModelDetailResponse
        company: { name: string; cif: string | null }
      }>(`/api/fiscal/models/${params.model}/${params.year}/${params.quarter}`)
      setPayload({
        detail: data.detail,
        companyName: data.company.name,
        companyCif: data.company.cif,
      })
    } catch (err) {
      setPayload(null)
      setError(err instanceof Error ? err.message : "No se pudo cargar el borrador del modelo.")
    } finally {
      setIsLoadingDetail(false)
    }
  }, [session?.activeCompanyId, params.model, params.year, params.quarter])

  useEffect(() => {
    if (session?.activeCompanyId) {
      void loadDetail()
    }
  }, [session?.activeCompanyId, loadDetail])

  const detail = payload?.detail ?? null
  const usesDraftLayout =
    detail !== null && DRAFT_SUPPORTED_MODELS.has(detail.modelCode)
  const sii303 =
    params.model === "303" &&
    (activeCompany?.siiMode === "OBLIGATORIO" || activeCompany?.siiMode === "VOLUNTARIO")
  const monthToken = /^(0[1-9]|1[0-2])$/.test(params.quarter ?? "")
  const quarterNumber = Number.parseInt(params.quarter ?? "", 10)
  const showMonthChooser =
    sii303 && !monthToken && params.quarter !== "anual" && params.quarter !== "annual" && quarterNumber >= 1 && quarterNumber <= 4

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/dashboard/fiscal/${params.model}`}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver al modelo
        </Link>
      </Button>

      {isLoadingDetail ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando borrador del modelo…
        </div>
      ) : showMonthChooser ? (
        <Card>
          <CardContent className="space-y-3 py-6">
            <p className="text-sm text-graphite-600">
              Esta empresa está en el SII. Elige el mes de este trimestre. El fichero trimestral no se presenta.
            </p>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2].map((offset) => {
                const month = (quarterNumber - 1) * 3 + offset + 1
                const token = String(month).padStart(2, "0")
                return (
                  <Button key={token} variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/fiscal/303/${params.year}/${token}`}>Periodo {token}</Link>
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-red-700">{error}</CardContent>
        </Card>
      ) : detail && payload && activeCompany ? (
        usesDraftLayout ? (
          <>
            {sii303 && monthToken ? (
              <p className="text-sm text-graphite-600">
                Periodo {params.quarter}. Los libros de facturas de este mes se envían en{" "}
                <Link href="/dashboard/fiscal/sii" className="font-medium text-emerald-800 underline">
                  Libros SII
                </Link>
                .
              </p>
            ) : null}
          <FiscalModelDraftView
            detail={detail}
            companyName={payload.companyName}
            companyCif={payload.companyCif}
            modelParam={params.model}
            quarterParam={params.quarter}
            year={Number.parseInt(params.year, 10)}
            onRefresh={loadDetail}
            taxDirectDebitIban={activeCompany.taxDirectDebitIban}
            taxDirectDebitBank={activeCompany.taxDirectDebitBank}
          />
          </>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-graphite-600">
              El borrador visual oficial aún no está disponible para el modelo {detail.modelCode}.
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  )
}

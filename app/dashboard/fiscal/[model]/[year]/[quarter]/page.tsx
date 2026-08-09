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

export default function FiscalModelDetailPage() {
  const params = useParams<{ model: string; year: string; quarter: string }>()
  const { session, activeCompany } = useRequireAuth()
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

  const usesDraftLayout =
    detail !== null && DRAFT_SUPPORTED_MODELS.has(detail.modelCode)

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
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-red-700">{error}</CardContent>
        </Card>
      ) : detail && activeCompany ? (
        usesDraftLayout ? (
          <FiscalModelDraftView
            detail={detail}
            companyName={activeCompany.name}
            companyCif={activeCompany.cif}
            modelParam={params.model}
            quarterParam={params.quarter}
            year={Number.parseInt(params.year, 10)}
            onRefresh={loadDetail}
          />
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

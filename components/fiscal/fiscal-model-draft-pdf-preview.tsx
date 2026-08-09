"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface FiscalModelDraftPdfPreviewProps {
  modelParam: string
  year: number
  quarterParam: string
  refreshKey?: number
  className?: string
}

export function FiscalModelDraftPdfPreview({
  modelParam,
  year,
  quarterParam,
  refreshKey = 0,
  className,
}: FiscalModelDraftPdfPreviewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  const pdfPath = useMemo(
    () => `/api/fiscal/models/${modelParam}/${year}/${quarterParam}/draft-pdf`,
    [modelParam, year, quarterParam],
  )

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null

    const loadPdf = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${pdfPath}?t=${refreshKey}`, { credentials: "include" })
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(payload?.error ?? "No se pudo generar la vista previa PDF.")
        }
        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        if (active) {
          setBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return objectUrl
          })
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Error al cargar el borrador PDF.")
          setBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return null
          })
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadPdf()

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [pdfPath, refreshKey])

  return (
    <div className={cn("relative min-h-[720px] bg-[#525659]", className)}>
      {loading ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#525659]/90 text-white">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Generando borrador oficial AEAT…</p>
        </div>
      ) : null}

      {error ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-6 text-center text-red-100">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm">{error}</p>
        </div>
      ) : null}

      {blobUrl && !error ? (
        <iframe
          title="Borrador oficial AEAT"
          src={`${blobUrl}#toolbar=1&navpanes=0`}
          className="h-[min(90vh,980px)] w-full border-0 bg-[#525659]"
        />
      ) : null}
    </div>
  )
}

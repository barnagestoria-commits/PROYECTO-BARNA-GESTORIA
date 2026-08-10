"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
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
  const [pdfReady, setPdfReady] = useState(false)

  const pdfUrl = useMemo(
    () => `/api/fiscal/models/${modelParam}/${year}/${quarterParam}/draft-pdf?t=${refreshKey}`,
    [modelParam, year, quarterParam, refreshKey],
  )

  useEffect(() => {
    let active = true

    const verifyPdf = async () => {
      setLoading(true)
      setError(null)
      setPdfReady(false)

      try {
        const response = await fetch(pdfUrl, { credentials: "include" })
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(payload?.error ?? "No se pudo generar la vista previa PDF.")
        }

        const contentType = response.headers.get("content-type") ?? ""
        if (!contentType.includes("pdf")) {
          throw new Error("La respuesta del servidor no es un PDF oficial.")
        }

        if (active) setPdfReady(true)
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Error al cargar el borrador PDF.")
          setPdfReady(false)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void verifyPdf()

    return () => {
      active = false
    }
  }, [pdfUrl])

  return (
    <div className={cn("relative w-full bg-[#525659]", className)}>
      {loading ? (
        <div className="absolute inset-0 z-10 flex h-[800px] flex-col items-center justify-center gap-3 bg-[#525659]/90 text-white">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Generando borrador oficial AEAT…</p>
        </div>
      ) : null}

      {error ? (
        <div className="flex h-[800px] flex-col items-center justify-center gap-2 px-6 text-center text-red-100">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm">{error}</p>
        </div>
      ) : null}

      {pdfReady && !error ? (
        <iframe
          title="Borrador oficial AEAT"
          src={`${pdfUrl}#toolbar=1&navpanes=0`}
          className="h-[800px] w-full border-0 bg-[#525659]"
        />
      ) : null}
    </div>
  )
}

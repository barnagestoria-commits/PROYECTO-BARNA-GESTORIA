"use client"

import { useEffect, useState } from "react"
import { FileText } from "lucide-react"
import { slicePdfToBlob } from "@/lib/ocr/extract-pdf-slice"

interface InvoiceDocumentPreviewProps {
  file: File | null
  fileName: string
  pageStart?: number
  pageEnd?: number
  isolatePages?: boolean
}

export function InvoiceDocumentPreview({
  file,
  fileName,
  pageStart,
  pageEnd,
  isolatePages = false,
}: InvoiceDocumentPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [pageLabel, setPageLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setObjectUrl(null)
      setPageLabel(null)
      return
    }

    const isPdf = file.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")
    let cancelled = false
    let currentUrl: string | null = null

    const load = async () => {
      if (isPdf && isolatePages && pageStart) {
        try {
          const blob = await slicePdfToBlob(await file.arrayBuffer(), pageStart, pageEnd ?? pageStart)
          if (cancelled) return
          currentUrl = URL.createObjectURL(blob)
          setObjectUrl(currentUrl)
          const end = pageEnd && pageEnd > pageStart ? pageEnd : pageStart
          setPageLabel(end === pageStart ? `Página ${pageStart}` : `Páginas ${pageStart}–${end}`)
          return
        } catch (error) {
          console.error("[invoice-preview] slice", error)
        }
      }

      currentUrl = URL.createObjectURL(file)
      if (cancelled) {
        URL.revokeObjectURL(currentUrl)
        return
      }
      setObjectUrl(currentUrl)
      setPageLabel(null)
    }

    void load()

    return () => {
      cancelled = true
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [file, fileName, isolatePages, pageStart, pageEnd])

  const isPdf = file?.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")
  const isImage =
    Boolean(file?.type.startsWith("image/")) || /\.(jpe?g|png|webp|gif)$/i.test(fileName)

  return (
    <aside className="flex h-[min(78vh,860px)] min-h-[320px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b bg-gray-50 px-3 py-2 text-sm text-gray-700">
        <FileText className="h-4 w-4 shrink-0 text-emerald-800" />
        <span className="truncate font-medium">{fileName || "Documento original"}</span>
        {pageLabel ? <span className="ml-auto shrink-0 text-xs text-gray-500">{pageLabel}</span> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-gray-100">
        {objectUrl && isPdf ? (
          <iframe
            src={`${objectUrl}#view=FitH&toolbar=0`}
            title={fileName}
            className="h-full w-full bg-white"
          />
        ) : objectUrl && isImage ? (
          <div className="h-full overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={objectUrl} alt={fileName} className="w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-500">
            No hay previsualización del documento. Revisa los datos con la factura abierta a
            un lado.
          </div>
        )}
      </div>
    </aside>
  )
}

"use client"

import { useEffect, useState } from "react"
import { FileText } from "lucide-react"

interface InvoiceDocumentPreviewProps {
  file: File | null
  fileName: string
}

export function InvoiceDocumentPreview({ file, fileName }: InvoiceDocumentPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setObjectUrl(null)
      return
    }

    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const isPdf = file?.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")
  const isImage =
    Boolean(file?.type.startsWith("image/")) || /\.(jpe?g|png|webp|gif)$/i.test(fileName)

  return (
    <aside className="flex min-h-[280px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm xl:min-h-[min(80vh,900px)]">
      <div className="flex items-center gap-2 border-b bg-gray-50 px-3 py-2 text-sm text-gray-700">
        <FileText className="h-4 w-4 shrink-0 text-emerald-800" />
        <span className="truncate font-medium">{fileName || "Documento original"}</span>
      </div>
      <div className="min-h-0 flex-1 bg-gray-100">
        {objectUrl && isPdf ? (
          <iframe
            src={objectUrl}
            title={fileName}
            className="h-[min(70vh,720px)] w-full bg-white xl:h-full xl:min-h-[min(80vh,900px)]"
          />
        ) : objectUrl && isImage ? (
          <div className="h-[min(70vh,720px)] overflow-auto xl:h-full xl:min-h-[min(80vh,900px)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={objectUrl} alt={fileName} className="w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-[min(40vh,320px)] items-center justify-center px-6 text-center text-sm text-gray-500">
            No hay previsualización del documento. Revisa los datos con la factura abierta a
            un lado.
          </div>
        )}
      </div>
    </aside>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, Maximize2, Minus, Plus, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { slicePdfToBlob } from "@/lib/ocr/extract-pdf-slice"
import { cn } from "@/lib/utils"

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
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    x: number
    y: number
    scrollLeft: number
    scrollTop: number
  } | null>(null)

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
  const canPreview = Boolean(objectUrl && (isPdf || isImage))
  const canPan = zoom > 1

  const fitToScreen = () => {
    setZoom(1)
    setRotation(0)
    requestAnimationFrame(() => {
      if (!viewportRef.current) return
      viewportRef.current.scrollLeft = 0
      viewportRef.current.scrollTop = 0
    })
  }

  const changeZoom = (delta: number) => {
    setZoom((current) => Math.min(3, Math.max(0.5, Math.round((current + delta) * 100) / 100)))
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canPan || !viewportRef.current) return
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || !viewportRef.current) return
    viewportRef.current.scrollLeft = drag.scrollLeft - (event.clientX - drag.x)
    viewportRef.current.scrollTop = drag.scrollTop - (event.clientY - drag.y)
  }

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <aside className="flex h-[62vh] min-h-[340px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:h-[calc(100vh-9.5rem)] lg:min-h-[520px]">
      <div className="flex flex-wrap items-center gap-1 border-b bg-gray-50 px-2 py-1.5 text-sm text-gray-700">
        <FileText className="mr-1 h-4 w-4 shrink-0 text-emerald-800" />
        <span className="min-w-0 flex-1 truncate font-medium">{fileName || "Documento original"}</span>
        {pageLabel ? <span className="shrink-0 text-[11px] text-gray-500">{pageLabel}</span> : null}
        <div className="ml-auto flex items-center gap-0.5 rounded-md border bg-white p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => changeZoom(-0.25)}
            disabled={!canPreview || zoom <= 0.5}
            aria-label="Alejar documento"
            title="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-10 text-center text-[10px] tabular-nums text-gray-500">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => changeZoom(0.25)}
            disabled={!canPreview || zoom >= 3}
            aria-label="Acercar documento"
            title="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fitToScreen}
            disabled={!canPreview}
            aria-label="Ajustar documento a la pantalla"
            title="Ajustar a pantalla"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setRotation((current) => (current + 90) % 360)}
            disabled={!canPreview}
            aria-label="Rotar documento 90 grados"
            title="Rotar 90°"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={cn(
          "relative min-h-0 flex-1 overflow-auto bg-gray-200/70",
          canPan ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {objectUrl && isPdf ? (
          <div
            className="relative mx-auto bg-white shadow-sm"
            style={{
              width: `${zoom * 100}%`,
              height: `${zoom * 100}%`,
              minWidth: `${zoom * 100}%`,
              minHeight: `${zoom * 100}%`,
            }}
          >
            <iframe
              src={`${objectUrl}#view=FitH&toolbar=0`}
              title={fileName}
              className={cn("h-full w-full bg-white", canPan && "pointer-events-none select-none")}
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: "center center",
              }}
            />
          </div>
        ) : objectUrl && isImage ? (
          <div
            className="flex min-h-full min-w-full items-center justify-center p-3"
            style={{
              width: `${zoom * 100}%`,
              height: `${zoom * 100}%`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={objectUrl}
              alt={fileName}
              draggable={false}
              className="max-h-full max-w-full select-none object-contain shadow-sm"
              style={{
                width: zoom < 1 ? `${zoom * 100}%` : "100%",
                transform: `rotate(${rotation}deg)`,
                transformOrigin: "center center",
              }}
            />
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

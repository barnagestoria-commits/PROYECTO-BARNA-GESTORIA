"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Camera, X, Zap, Hand, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

const SCAN_TIPS = [
  { text: "Coloca la factura dentro del recuadro", icon: Zap },
  { text: "Mantén la cámara quieta", icon: Hand },
  { text: "Evita reflejos", icon: Sun },
] as const

interface InvoiceCameraCaptureProps {
  open: boolean
  onClose: () => void
  onCapture: (file: File) => void
}

export function InvoiceCameraCapture({ open, onClose, onCapture }: InvoiceCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [tipIndex, setTipIndex] = useState(0)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    stopCamera()

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Tu navegador no permite acceder a la cámara.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setCameraError(
        "No se pudo activar la cámara. Comprueba los permisos del navegador e inténtalo de nuevo.",
      )
    }
  }, [stopCamera])

  useEffect(() => {
    if (!open) {
      stopCamera()
      return
    }

    startCamera()
    return () => stopCamera()
  }, [open, startCamera, stopCamera])

  useEffect(() => {
    if (!open) return

    const interval = window.setInterval(() => {
      setTipIndex((prev) => (prev + 1) % SCAN_TIPS.length)
    }, 3200)

    return () => window.clearInterval(interval)
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open, onClose])

  const handleCapture = async () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return

    setIsCapturing(true)
    try {
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      ctx.drawImage(video, 0, 0)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      )
      if (!blob) return

      const file = new File([blob], `factura-${Date.now()}.jpg`, { type: "image/jpeg" })
      onCapture(file)
      onClose()
    } finally {
      setIsCapturing(false)
    }
  }

  if (!open) return null

  const currentTip = SCAN_TIPS[tipIndex]
  const TipIcon = currentTip.icon

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Escanear factura con cámara"
    >
      <div className="relative flex-1 overflow-hidden">
        {cameraError ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white">
            <Camera className="h-12 w-12 text-emerald-400 opacity-80" />
            <p className="max-w-sm text-sm text-gray-200">{cameraError}</p>
            <Button variant="outline" size="sm" onClick={startCamera} className="border-white/30 text-white">
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 h-full w-full object-cover"
            />

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div
                className={cn(
                  "relative w-[min(88vw,340px)] rounded-xl border-2 border-white/90",
                  "aspect-[3/4] shadow-[0_0_0_9999px_rgba(0,0,0,0.58)]",
                )}
              >
                <span className="absolute -left-0.5 -top-0.5 h-7 w-7 rounded-tl-lg border-l-[3px] border-t-[3px] border-emerald-400" />
                <span className="absolute -right-0.5 -top-0.5 h-7 w-7 rounded-tr-lg border-r-[3px] border-t-[3px] border-emerald-400" />
                <span className="absolute -bottom-0.5 -left-0.5 h-7 w-7 rounded-bl-lg border-b-[3px] border-l-[3px] border-emerald-400" />
                <span className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-br-lg border-b-[3px] border-r-[3px] border-emerald-400" />
              </div>

              <p className="mt-5 text-xs font-medium uppercase tracking-widest text-white/70">
                Encuadra la factura
              </p>
            </div>

            <div className="absolute left-0 right-0 top-4 flex justify-center px-4">
              <div
                key={tipIndex}
                className="flex max-w-sm items-center gap-2 rounded-full border border-white/20 bg-black/55 px-4 py-2.5 text-sm text-white shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-500"
              >
                <TipIcon className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{currentTip.text}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/90 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <X className="mr-1 h-4 w-4" />
          Cancelar
        </Button>

        <Button
          size="lg"
          onClick={handleCapture}
          disabled={!!cameraError || isCapturing}
          className="rounded-full bg-emerald-600 px-8 hover:bg-emerald-500"
        >
          <Camera className="mr-2 h-5 w-5" />
          {isCapturing ? "Capturando…" : "Capturar"}
        </Button>

        <div className="w-[88px]" aria-hidden />
      </div>
    </div>
  )
}

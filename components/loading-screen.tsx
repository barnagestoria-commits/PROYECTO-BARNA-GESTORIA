"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface LoadingScreenProps {
  onLoadingComplete?: () => void
  duration?: number
}

export function LoadingScreen({ onLoadingComplete, duration = 2500 }: LoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [animationPhase, setAnimationPhase] = useState<"enter" | "pulse" | "exit">("enter")

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setAnimationPhase("pulse")
    }, 500)

    const timer2 = setTimeout(() => {
      setAnimationPhase("exit")
    }, duration - 500)

    const timer3 = setTimeout(() => {
      setIsVisible(false)
      onLoadingComplete?.()
    }, duration)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [duration, onLoadingComplete])

  if (!isVisible) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 transition-opacity duration-500",
        animationPhase === "exit" && "opacity-0",
      )}
    >
      <div className="flex flex-col items-center space-y-8">
        {/* Logo con animaciones */}
        <div className="relative">
          <div
            className={cn(
              "transition-all duration-1000 ease-out",
              animationPhase === "enter" && "scale-0 rotate-180 opacity-0",
              animationPhase === "pulse" && "scale-100 rotate-0 opacity-100",
              animationPhase === "exit" && "scale-110 opacity-90",
            )}
          >
            <Image
              src="/images/barna-logo-updated.png"
              alt="Barna Gestoría"
              width={120}
              height={120}
              className="object-contain drop-shadow-lg"
              priority
            />
          </div>

          {/* Círculo de carga animado */}
          <div
            className={cn(
              "absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-600 animate-spin",
              animationPhase === "pulse" && "opacity-100",
              animationPhase !== "pulse" && "opacity-0",
            )}
            style={{
              width: "140px",
              height: "140px",
              top: "-10px",
              left: "-10px",
            }}
          />

          {/* Efecto de resplandor */}
          <div
            className={cn(
              "absolute inset-0 rounded-full bg-emerald-200 opacity-20 blur-xl transition-all duration-1000",
              animationPhase === "pulse" && "scale-150 opacity-30",
              animationPhase !== "pulse" && "scale-100 opacity-0",
            )}
            style={{
              width: "120px",
              height: "120px",
            }}
          />
        </div>

        {/* Texto animado */}
        <div className="text-center space-y-2">
          <h1
            className={cn(
              "text-3xl md:text-4xl font-bold text-emerald-800 transition-all duration-1000 delay-300",
              animationPhase === "enter" && "opacity-0 translate-y-4",
              animationPhase === "pulse" && "opacity-100 translate-y-0",
              animationPhase === "exit" && "opacity-80 translate-y-0",
            )}
          >
            Barna Gestoría
          </h1>
          <p
            className={cn(
              "text-emerald-600 text-lg transition-all duration-1000 delay-500",
              animationPhase === "enter" && "opacity-0 translate-y-4",
              animationPhase === "pulse" && "opacity-100 translate-y-0",
              animationPhase === "exit" && "opacity-60 translate-y-0",
            )}
          >
            Contable, Fiscal y Laboral
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="w-64 h-1 bg-stone-200 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-2000 ease-out",
              animationPhase === "enter" && "w-0",
              animationPhase === "pulse" && "w-full",
              animationPhase === "exit" && "w-full opacity-80",
            )}
          />
        </div>

        {/* Puntos de carga */}
        <div className="flex space-x-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 bg-emerald-600 rounded-full transition-all duration-300",
                animationPhase === "pulse" && "animate-bounce",
              )}
              style={{
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Elementos decorativos de fondo */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-emerald-100 rounded-full opacity-20 animate-pulse" />
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-melon-100 rounded-full opacity-20 animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-10 w-16 h-16 bg-emerald-200 rounded-full opacity-10 animate-pulse delay-500" />
      <div className="absolute bottom-1/3 left-1/3 w-20 h-20 bg-stone-200 rounded-full opacity-15 animate-pulse delay-700" />
    </div>
  )
}

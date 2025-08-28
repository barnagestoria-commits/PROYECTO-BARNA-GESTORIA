"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useSeasonalTheme } from "@/hooks/use-seasonal-theme"
import { SeasonalDecorations } from "./seasonal-decorations"
import { LogoFallback } from "./logo-fallback"

interface SeasonalLoadingScreenProps {
  onLoadingComplete?: () => void
  duration?: number
}

export function SeasonalLoadingScreen({ onLoadingComplete, duration = 3000 }: SeasonalLoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [animationPhase, setAnimationPhase] = useState<"enter" | "pulse" | "exit">("enter")
  const [logoError, setLogoError] = useState(false)
  const theme = useSeasonalTheme()

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

  // Helper function to get secondary accent color
  const getSecondaryAccent = (accentClass: string) => {
    if (!accentClass || typeof accentClass !== "string") return "text-emerald-600"
    return accentClass.replace("700", "600")
  }

  const getTertiaryAccent = (accentClass: string) => {
    if (!accentClass || typeof accentClass !== "string") return "text-emerald-500"
    return accentClass.replace("700", "500")
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br transition-opacity duration-500",
        theme.colors.background,
        animationPhase === "exit" && "opacity-0",
      )}
    >
      {/* Decoraciones estacionales de fondo */}
      <SeasonalDecorations theme={theme} />

      <div className="flex flex-col items-center space-y-8 relative z-10">
        {/* Logo profesional para pantalla de carga */}
        <div className="relative">
          <div
            className={cn(
              "transition-all duration-1000 ease-out",
              animationPhase === "enter" && "scale-0 rotate-180 opacity-0",
              animationPhase === "pulse" && "scale-100 rotate-0 opacity-100",
              animationPhase === "exit" && "scale-110 opacity-90",
              theme.specialEffects?.glow,
            )}
          >
            {!logoError ? (
              <Image
                src="/images/barna-logo-loading-clean.png"
                alt="Barna Gestoría"
                width={160}
                height={160}
                className="object-contain drop-shadow-2xl"
                onError={() => setLogoError(true)}
                priority
              />
            ) : (
              <div className="w-[160px] h-[160px] flex items-center justify-center">
                <LogoFallback size="lg" variant="icon" />
              </div>
            )}
          </div>

          {/* Círculo de carga con colores estacionales - más grande para el nuevo logo */}
          <div
            className={cn(
              "absolute inset-0 rounded-full border-4 border-transparent animate-spin",
              animationPhase === "pulse" && "opacity-100",
              animationPhase !== "pulse" && "opacity-0",
            )}
            style={{
              width: "180px",
              height: "180px",
              top: "-10px",
              left: "-10px",
              borderTopColor:
                theme.season === "spring"
                  ? "#145A32"
                  : theme.season === "summer"
                    ? "#C2A878"
                    : theme.season === "autumn"
                      ? "#C2A878"
                      : theme.season === "winter"
                        ? "#145A32"
                        : theme.season === "christmas"
                          ? "#145A32"
                          : "#145A32",
            }}
          />

          {/* Efecto de resplandor estacional - ajustado para el nuevo logo */}
          <div
            className={cn(
              "absolute inset-0 rounded-full opacity-20 blur-xl transition-all duration-1000",
              animationPhase === "pulse" && "scale-150 opacity-30",
              animationPhase !== "pulse" && "scale-100 opacity-0",
            )}
            style={{
              width: "160px",
              height: "160px",
              backgroundColor:
                theme.season === "spring"
                  ? "#145A32"
                  : theme.season === "summer"
                    ? "#C2A878"
                    : theme.season === "autumn"
                      ? "#C2A878"
                      : theme.season === "winter"
                        ? "#145A32"
                        : theme.season === "christmas"
                          ? "#145A32"
                          : "#145A32",
            }}
          />

          {/* Efectos especiales por temporada */}
          {theme.season === "christmas" && (
            <div className="absolute -top-4 -right-4 text-red-500 animate-bounce">🎄</div>
          )}
          {theme.season === "spring" && <div className="absolute -top-2 -right-2 text-pink-500 animate-pulse">🌸</div>}
          {theme.season === "summer" && (
            <div className="absolute -top-3 -right-3 text-yellow-500 animate-spin" style={{ animationDuration: "4s" }}>
              ☀️
            </div>
          )}
          {theme.season === "autumn" && (
            <div className="absolute -top-2 -right-2 text-orange-500 animate-bounce">🍂</div>
          )}
          {theme.season === "winter" && <div className="absolute -top-2 -right-2 text-blue-300 animate-pulse">❄️</div>}
        </div>

        {/* Texto con colores de la nueva paleta */}
        <div className="text-center space-y-2">
          <h1
            className={cn(
              "text-3xl md:text-4xl font-bold transition-all duration-1000 delay-300 text-pine-900",
              animationPhase === "enter" && "opacity-0 translate-y-4",
              animationPhase === "pulse" && "opacity-100 translate-y-0",
              animationPhase === "exit" && "opacity-80 translate-y-0",
            )}
          >
            Barna Gestoría
          </h1>
          <p
            className={cn(
              "text-lg transition-all duration-1000 delay-500 text-emerald-800",
              animationPhase === "enter" && "opacity-0 translate-y-4",
              animationPhase === "pulse" && "opacity-100 translate-y-0",
              animationPhase === "exit" && "opacity-60 translate-y-0",
            )}
          >
            Contable, Fiscal y Laboral
          </p>
          <p
            className={cn(
              "text-sm font-medium transition-all duration-1000 delay-700 text-gold-700",
              animationPhase === "enter" && "opacity-0 translate-y-4",
              animationPhase === "pulse" && "opacity-100 translate-y-0",
              animationPhase === "exit" && "opacity-40 translate-y-0",
            )}
          >
            ✨ Edición {theme.name} ✨
          </p>
        </div>

        {/* Barra de progreso con colores de la nueva paleta */}
        <div className="w-64 h-2 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-2000 ease-out",
              animationPhase === "enter" && "w-0",
              animationPhase === "pulse" && "w-full",
              animationPhase === "exit" && "w-full opacity-80",
            )}
            style={{
              background: "linear-gradient(90deg, #145A32 0%, #C2A878 50%, #0F3D2E 100%)",
            }}
          />
        </div>

        {/* Puntos de carga con colores de la nueva paleta */}
        <div className="flex space-x-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "w-3 h-3 rounded-full transition-all duration-300",
                animationPhase === "pulse" && "animate-bounce",
              )}
              style={{
                backgroundColor: i === 0 ? "#145A32" : i === 1 ? "#C2A878" : "#0F3D2E",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>

        {/* Mensaje estacional especial con nuevos colores */}
        {theme.season === "christmas" && (
          <div className="text-center space-y-1 animate-pulse">
            <p className="text-emerald-800 font-medium">🎄 ¡Felices Fiestas! 🎄</p>
            <p className="text-pine-800 text-sm">Que tengas un próspero Año Nuevo</p>
          </div>
        )}
        {theme.season === "spring" && (
          <div className="text-center animate-pulse">
            <p className="text-emerald-800 font-medium">🌱 ¡Bienvenida Primavera! 🌸</p>
          </div>
        )}
        {theme.season === "summer" && (
          <div className="text-center animate-pulse">
            <p className="text-gold-800 font-medium">☀️ ¡Disfruta del Verano! 🏖️</p>
          </div>
        )}
        {theme.season === "autumn" && (
          <div className="text-center animate-pulse">
            <p className="text-gold-800 font-medium">🍂 ¡Hermoso Otoño! 🍁</p>
          </div>
        )}
        {theme.season === "winter" && (
          <div className="text-center animate-pulse">
            <p className="text-emerald-800 font-medium">❄️ ¡Cálido Invierno! ⛄</p>
          </div>
        )}
      </div>
    </div>
  )
}

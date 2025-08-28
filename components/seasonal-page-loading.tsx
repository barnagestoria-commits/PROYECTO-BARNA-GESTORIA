"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import { useSeasonalTheme } from "@/hooks/use-seasonal-theme"

interface SeasonalPageLoadingProps {
  message?: string
  size?: "sm" | "md" | "lg"
}

export function SeasonalPageLoading({ message = "Cargando...", size = "md" }: SeasonalPageLoadingProps) {
  const theme = useSeasonalTheme()

  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[200px] space-y-4 bg-gradient-to-br",
        theme.colors.secondary,
      )}
    >
      <div className="relative">
        <Image
          src="/images/barna-logo-updated.png"
          alt="Barna Gestoría"
          width={size === "sm" ? 48 : size === "md" ? 64 : 96}
          height={size === "sm" ? 48 : size === "md" ? 64 : 96}
          className={cn("object-contain animate-pulse", sizeClasses[size])}
        />

        {/* Spinner estacional */}
        <div
          className={cn(
            "absolute inset-0 rounded-full border-2 border-transparent animate-spin",
            size === "sm" && "border-2",
            size === "md" && "border-3",
            size === "lg" && "border-4",
          )}
          style={{
            width: size === "sm" ? "56px" : size === "md" ? "72px" : "104px",
            height: size === "sm" ? "56px" : size === "md" ? "72px" : "104px",
            top: "-4px",
            left: "-4px",
            borderTopColor:
              theme.season === "spring"
                ? "#10b981"
                : theme.season === "summer"
                  ? "#f59e0b"
                  : theme.season === "autumn"
                    ? "#d97706"
                    : theme.season === "winter"
                      ? "#0ea5e9"
                      : theme.season === "christmas"
                        ? "#dc2626"
                        : "#10b981",
          }}
        />

        {/* Emoji estacional */}
        <div className="absolute -top-1 -right-1 text-lg animate-bounce">
          {theme.season === "spring" && "🌸"}
          {theme.season === "summer" && "☀️"}
          {theme.season === "autumn" && "🍂"}
          {theme.season === "winter" && "❄️"}
          {theme.season === "christmas" && "🎄"}
        </div>
      </div>

      <p className={cn("font-medium animate-pulse", theme.colors.accent || "text-emerald-700")}>{message}</p>

      {/* Indicador de temporada */}
      <div
        className={cn(
          "text-xs px-3 py-1 rounded-full",
          theme.colors.secondary,
          theme.colors.accent || "text-emerald-700",
        )}
      >
        Edición {theme.name}
      </div>
    </div>
  )
}

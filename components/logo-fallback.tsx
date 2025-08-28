"use client"

import { Leaf } from "lucide-react"
import { cn } from "@/lib/utils"

interface LogoFallbackProps {
  size?: "sm" | "md" | "lg"
  className?: string
  variant?: "icon" | "text" | "combined"
}

export function LogoFallback({ size = "md", className, variant = "icon" }: LogoFallbackProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  }

  const textSizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  }

  // Logo circular con barras y hoja (sin texto) - Nueva paleta
  const IconOnly = () => (
    <div
      className={cn(
        "relative flex items-center justify-center shadow-md rounded-full border-2 border-pine-900",
        sizeClasses[size],
        className,
      )}
      style={{
        background: "linear-gradient(135deg, #0F3D2E 0%, #145A32 100%)",
      }}
    >
      {/* Hoja orgánica */}
      <div
        className="absolute"
        style={{
          left: size === "sm" ? "4px" : size === "md" ? "6px" : "8px",
          top: size === "sm" ? "6px" : size === "md" ? "8px" : "10px",
          transform: "rotate(-20deg)",
        }}
      >
        <Leaf className="text-sand-50 opacity-90" size={size === "sm" ? 8 : size === "md" ? 10 : 12} />
      </div>

      {/* Barras de crecimiento con toque dorado */}
      <div
        className="absolute flex items-end gap-0.5"
        style={{
          right: size === "sm" ? "4px" : size === "md" ? "6px" : "8px",
          bottom: size === "sm" ? "4px" : size === "md" ? "6px" : "8px",
        }}
      >
        <div
          className="opacity-90 rounded-sm"
          style={{
            background: "linear-gradient(to top, #C2A878, #EAE3D2)",
            width: size === "sm" ? "1.5px" : "2px",
            height: size === "sm" ? "6px" : size === "md" ? "8px" : "10px",
          }}
        />
        <div
          className="opacity-90 rounded-sm"
          style={{
            background: "linear-gradient(to top, #C2A878, #EAE3D2)",
            width: size === "sm" ? "1.5px" : "2px",
            height: size === "sm" ? "8px" : size === "md" ? "12px" : "15px",
          }}
        />
        <div
          className="opacity-90 rounded-sm"
          style={{
            background: "linear-gradient(to top, #C2A878, #EAE3D2)",
            width: size === "sm" ? "1.5px" : "2px",
            height: size === "sm" ? "4px" : size === "md" ? "6px" : "8px",
          }}
        />
      </div>
    </div>
  )

  if (variant === "icon") {
    return <IconOnly />
  }

  if (variant === "text") {
    return (
      <div className={cn("font-bold text-pine-900", textSizeClasses[size], className)}>
        <span className="hidden sm:inline">Barna Gestoría</span>
        <span className="sm:hidden">Barna</span>
      </div>
    )
  }

  // Combined: icono + texto separado
  return (
    <div className="flex items-center gap-2 md:gap-3">
      <IconOnly />
      <div className={cn("font-bold text-pine-900", textSizeClasses[size])}>
        <span className="hidden sm:inline">Barna Gestoría</span>
        <span className="sm:hidden">Barna</span>
      </div>
    </div>
  )
}

"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { LogoFallback } from "./logo-fallback"

interface ResponsiveLogoProps {
  size?: "sm" | "md" | "lg"
  showText?: boolean
  className?: string
  textClassName?: string
}

export function ResponsiveLogo({ size = "md", showText = false, className, textClassName }: ResponsiveLogoProps) {
  const [imageError, setImageError] = useState(false)

  const sizeClasses = {
    sm: "w-6 h-6 md:w-8 md:h-8",
    md: "w-8 h-8 md:w-10 md:h-10",
    lg: "w-10 h-10 md:w-12 md:h-12",
  }

  const textSizeClasses = {
    sm: "text-base md:text-lg",
    md: "text-lg md:text-xl",
    lg: "text-xl md:text-2xl",
  }

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {!imageError ? (
        <Image
          src="/images/barna-logo-icon.png"
          alt="Barna Gestoría Logo"
          width={size === "sm" ? 24 : size === "md" ? 32 : 40}
          height={size === "sm" ? 24 : size === "md" ? 32 : 40}
          className={cn("object-contain", sizeClasses[size], className)}
          onError={() => setImageError(true)}
          priority
        />
      ) : (
        // Fallback icon si la imagen no carga - circular
        <LogoFallback size={size} variant="icon" className={className} />
      )}
      {showText && (
        <span className={cn("font-bold text-emerald-800", textSizeClasses[size], textClassName)}>
          <span className="hidden sm:inline">Barna Gestoría</span>
          <span className="sm:hidden">Barna</span>
        </span>
      )}
    </div>
  )
}

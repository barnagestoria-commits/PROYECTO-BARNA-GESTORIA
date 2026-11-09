"use client"

import { cn } from "@/lib/utils"
import { TaxlynMark } from "@/components/taxlyn-mark"

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

  const IconOnly = () => <TaxlynMark className={cn(sizeClasses[size], className)} />

  if (variant === "icon") {
    return <IconOnly />
  }

  if (variant === "text") {
    return (
      <div className={cn("font-bold text-pine-900", textSizeClasses[size], className)}>
        <span className="hidden sm:inline">Taxlyn</span>
        <span className="sm:hidden">Taxlyn</span>
      </div>
    )
  }

  // Combined: icono + texto separado
  return (
    <div className="flex items-center gap-2 md:gap-3">
      <IconOnly />
      <div className={cn("font-bold text-pine-900", textSizeClasses[size])}>
        <span className="hidden sm:inline">Taxlyn</span>
        <span className="sm:hidden">Taxlyn</span>
      </div>
    </div>
  )
}

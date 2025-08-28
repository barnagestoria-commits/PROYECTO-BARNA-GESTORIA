"use client"

import { useEffect, useState } from "react"
import { ResponsiveLogo } from "./responsive-logo"
import { LogoFallback } from "./logo-fallback"

interface LogoCheckerProps {
  size?: "sm" | "md" | "lg"
  showText?: boolean
  className?: string
  textClassName?: string
}

export function LogoChecker({ size = "md", showText = true, className, textClassName }: LogoCheckerProps) {
  const [logoExists, setLogoExists] = useState<boolean | null>(null)

  useEffect(() => {
    const checkLogo = async () => {
      try {
        const response = await fetch("/images/barna-logo-updated.png", { method: "HEAD" })
        setLogoExists(response.ok)
      } catch {
        setLogoExists(false)
      }
    }

    checkLogo()
  }, [])

  if (logoExists === null) {
    // Mostrar fallback mientras se verifica
    return <LogoFallback size={size} variant="combined" className={className} />
  }

  if (logoExists) {
    return <ResponsiveLogo size={size} showText={showText} className={className} textClassName={textClassName} />
  }

  // Si el logo no existe, usar el fallback
  return <LogoFallback size={size} variant="combined" className={className} />
}

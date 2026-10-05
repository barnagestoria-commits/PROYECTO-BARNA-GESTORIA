"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { SeasonalLoadingScreen } from "./seasonal-loading-screen"

interface AppWrapperProps {
  children: React.ReactNode
}

const AUTH_PATHS = ["/login", "/register", "/auth/complete"]

export function AppWrapper({ children }: AppWrapperProps) {
  const pathname = usePathname()
  const skipLoading = AUTH_PATHS.some((path) => pathname === path || pathname?.startsWith(`${path}/`))
  const [isLoading, setIsLoading] = useState(!skipLoading)
  const [showContent, setShowContent] = useState(skipLoading)
  const [hasPlayedIntro, setHasPlayedIntro] = useState(skipLoading)

  const handleLoadingComplete = useCallback(() => {
    setIsLoading(false)
    setHasPlayedIntro(true)
    window.setTimeout(() => {
      setShowContent(true)
    }, 100)
  }, [])

  useEffect(() => {
    if (skipLoading || hasPlayedIntro) {
      setIsLoading(false)
      setShowContent(true)
      return
    }

    setIsLoading(true)
    setShowContent(false)
  }, [hasPlayedIntro, skipLoading])

  return (
    <>
      {isLoading && <SeasonalLoadingScreen onLoadingComplete={handleLoadingComplete} />}
      <div className={`min-w-0 w-full max-w-full overflow-x-hidden transition-opacity duration-500 ${showContent ? "opacity-100" : "opacity-0"}`}>
        {children}
      </div>
    </>
  )
}

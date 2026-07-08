"use client"

import type React from "react"

import { useState, useEffect } from "react"
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

  useEffect(() => {
    if (skipLoading) {
      setIsLoading(false)
      setShowContent(true)
      return
    }

    setIsLoading(true)
    setShowContent(false)

    // Simular carga de recursos
    const preloadResources = async () => {
      const logoImage = new Image()
      logoImage.src = "/images/barna-logo-updated.png"

      await new Promise((resolve) => {
        logoImage.onload = resolve
        logoImage.onerror = resolve
      })

      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    preloadResources()
  }, [skipLoading])

  const handleLoadingComplete = () => {
    setIsLoading(false)
    setTimeout(() => {
      setShowContent(true)
    }, 100)
  }

  return (
    <>
      {isLoading && <SeasonalLoadingScreen onLoadingComplete={handleLoadingComplete} />}
      <div className={`transition-opacity duration-500 ${showContent ? "opacity-100" : "opacity-0"}`}>{children}</div>
    </>
  )
}

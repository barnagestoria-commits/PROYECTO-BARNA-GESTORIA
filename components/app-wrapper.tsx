"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { SeasonalLoadingScreen } from "./seasonal-loading-screen"

interface AppWrapperProps {
  children: React.ReactNode
}

export function AppWrapper({ children }: AppWrapperProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    // Simular carga de recursos
    const preloadResources = async () => {
      // Precargar imágenes críticas
      const logoImage = new Image()
      logoImage.src = "/images/barna-logo-updated.png"

      await new Promise((resolve) => {
        logoImage.onload = resolve
        logoImage.onerror = resolve
      })

      // Simular carga de otros recursos
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    preloadResources()
  }, [])

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

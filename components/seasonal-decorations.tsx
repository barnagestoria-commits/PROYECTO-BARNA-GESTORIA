"use client"

import { Leaf, Sun, Snowflake, Star, Gift, Heart, Flower, TreePine } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SeasonalTheme } from "@/hooks/use-seasonal-theme"

interface SeasonalDecorationsProps {
  theme: SeasonalTheme
  className?: string
}

export function SeasonalDecorations({ theme, className }: SeasonalDecorationsProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "flower":
        return <Flower className="w-full h-full" />
      case "leaf":
      case "maple-leaf":
        return <Leaf className="w-full h-full" />
      case "butterfly":
        return <Heart className="w-full h-full" />
      case "sun":
        return <Sun className="w-full h-full" />
      case "wave":
        return <div className="w-full h-full rounded-full bg-current opacity-60" />
      case "palm":
        return <TreePine className="w-full h-full" />
      case "snowflake":
        return <Snowflake className="w-full h-full" />
      case "icicle":
        return <div className="w-2 h-full bg-current rounded-b-full opacity-70" />
      case "frost":
        return <Star className="w-full h-full" />
      case "star":
        return <Star className="w-full h-full" />
      case "gift":
        return <Gift className="w-full h-full" />
      case "acorn":
        return <div className="w-full h-full rounded-full bg-current opacity-80" />
      case "pumpkin":
        return <div className="w-full h-full rounded-full bg-current opacity-70" />
      default:
        return <div className="w-full h-full rounded-full bg-current opacity-50" />
    }
  }

  const getRandomPosition = () => ({
    top: `${Math.random() * 80 + 10}%`,
    left: `${Math.random() * 80 + 10}%`,
  })

  const getRandomDelay = () => `${Math.random() * 2}s`

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {theme.decorativeElements.map((element, elementIndex) =>
        Array.from({ length: element.count }).map((_, index) => {
          const position = getRandomPosition()
          const delay = getRandomDelay()
          const colorClass = theme.colors.decorative[index % theme.colors.decorative.length]

          return (
            <div
              key={`${element.type}-${elementIndex}-${index}`}
              className={cn(
                "absolute w-8 h-8 opacity-20 transition-all duration-1000",
                colorClass.replace("bg-", "text-"),
                element.animation,
              )}
              style={{
                ...position,
                animationDelay: delay,
                animationDuration: element.type === "sun" ? "8s" : "3s",
              }}
            >
              {getIcon(element.type)}
            </div>
          )
        }),
      )}

      {/* Partículas especiales para navidad e invierno */}
      {theme.specialEffects?.particles && (
        <div className="absolute inset-0">
          {Array.from({ length: 20 }).map((_, index) => (
            <div
              key={`particle-${index}`}
              className="absolute w-1 h-1 bg-white rounded-full opacity-30 animate-pulse"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

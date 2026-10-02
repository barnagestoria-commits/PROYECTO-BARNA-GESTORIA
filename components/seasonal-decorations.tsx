"use client"

import { useEffect, useState } from "react"
import { Leaf, Sun, Snowflake, Star, Gift, Heart, Flower, TreePine } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SeasonalTheme } from "@/hooks/use-seasonal-theme"

interface SeasonalDecorationsProps {
  theme: SeasonalTheme
  className?: string
}

interface DecorationItem {
  key: string
  type: string
  animation?: string
  colorClass: string
  top: string
  left: string
  delay: string
  duration: string
}

function getIcon(type: string) {
  switch (type) {
    case "flower":
      return <Flower className="h-full w-full" />
    case "leaf":
    case "maple-leaf":
      return <Leaf className="h-full w-full" />
    case "butterfly":
      return <Heart className="h-full w-full" />
    case "sun":
      return <Sun className="h-full w-full" />
    case "wave":
      return <div className="h-full w-full rounded-full bg-current opacity-60" />
    case "palm":
      return <TreePine className="h-full w-full" />
    case "snowflake":
      return <Snowflake className="h-full w-full" />
    case "icicle":
      return <div className="h-full w-2 rounded-b-full bg-current opacity-70" />
    case "frost":
    case "star":
      return <Star className="h-full w-full" />
    case "gift":
      return <Gift className="h-full w-full" />
    case "acorn":
      return <div className="h-full w-full rounded-full bg-current opacity-80" />
    case "pumpkin":
      return <div className="h-full w-full rounded-full bg-current opacity-70" />
    default:
      return <div className="h-full w-full rounded-full bg-current opacity-50" />
  }
}

export function SeasonalDecorations({ theme, className }: SeasonalDecorationsProps) {
  const [items, setItems] = useState<DecorationItem[]>([])

  useEffect(() => {
    const next: DecorationItem[] = []

    theme.decorativeElements.forEach((element, elementIndex) => {
      Array.from({ length: element.count }).forEach((_, index) => {
        next.push({
          key: `${element.type}-${elementIndex}-${index}`,
          type: element.type,
          animation: element.animation,
          colorClass: theme.colors.decorative[index % theme.colors.decorative.length],
          top: `${Math.random() * 80 + 10}%`,
          left: `${Math.random() * 80 + 10}%`,
          delay: `${Math.random() * 2}s`,
          duration: element.type === "sun" ? "8s" : "3s",
        })
      })
    })

    if (theme.specialEffects?.particles) {
      Array.from({ length: 20 }).forEach((_, index) => {
        next.push({
          key: `particle-${index}`,
          type: "particle",
          top: `${Math.random() * 100}%`,
          left: `${Math.random() * 100}%`,
          delay: `${Math.random() * 3}s`,
          duration: `${2 + Math.random() * 2}s`,
          colorClass: "",
        })
      })
    }

    setItems(next)
  }, [theme])

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {items.map((item) =>
        item.type === "particle" ? (
          <div
            key={item.key}
            className="absolute h-1 w-1 animate-pulse rounded-full bg-white opacity-30"
            style={{
              top: item.top,
              left: item.left,
              animationDelay: item.delay,
              animationDuration: item.duration,
            }}
          />
        ) : (
          <div
            key={item.key}
            className={cn(
              "absolute h-8 w-8 opacity-20 transition-all duration-1000",
              item.colorClass.replace("bg-", "text-"),
              item.animation,
            )}
            style={{
              top: item.top,
              left: item.left,
              animationDelay: item.delay,
              animationDuration: item.duration,
            }}
          >
            {getIcon(item.type)}
          </div>
        ),
      )}
    </div>
  )
}

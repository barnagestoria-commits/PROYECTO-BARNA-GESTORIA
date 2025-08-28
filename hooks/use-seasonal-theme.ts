"use client"

import { useMemo } from "react"

export type Season = "spring" | "summer" | "autumn" | "winter" | "christmas" | "new-year"

export interface SeasonalTheme {
  season: Season
  name: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    decorative: string[]
  }
  decorativeElements: {
    type: string
    count: number
    animation: string
  }[]
  specialEffects?: {
    particles?: boolean
    glow?: string
    pattern?: string
  }
}

export function useSeasonalTheme(): SeasonalTheme {
  return useMemo(() => {
    const now = new Date()
    const month = now.getMonth() + 1 // 1-12
    const day = now.getDate()

    // Fechas especiales tienen prioridad
    if ((month === 12 && day >= 20) || (month === 1 && day <= 6)) {
      return {
        season: "christmas",
        name: "Navidad y Año Nuevo",
        colors: {
          primary: "from-red-600 to-green-600",
          secondary: "from-red-50 to-green-50",
          accent: "text-red-700",
          background: "from-red-50 via-white to-green-50",
          decorative: ["bg-red-200", "bg-green-200", "bg-yellow-200", "bg-red-300"],
        },
        decorativeElements: [
          { type: "snowflake", count: 6, animation: "animate-bounce" },
          { type: "star", count: 4, animation: "animate-pulse" },
          { type: "gift", count: 2, animation: "animate-pulse" },
        ],
        specialEffects: {
          particles: true,
          glow: "shadow-red-200",
          pattern: "christmas",
        },
      }
    }

    // Estaciones regulares
    if (month >= 3 && month <= 5) {
      return {
        season: "spring",
        name: "Primavera",
        colors: {
          primary: "from-emerald-500 to-green-500",
          secondary: "from-green-50 to-emerald-50",
          accent: "text-green-700",
          background: "from-green-50 via-emerald-50 to-lime-50",
          decorative: ["bg-pink-200", "bg-green-200", "bg-yellow-200", "bg-lime-200"],
        },
        decorativeElements: [
          { type: "flower", count: 5, animation: "animate-pulse" },
          { type: "leaf", count: 4, animation: "animate-bounce" },
          { type: "butterfly", count: 2, animation: "animate-ping" },
        ],
        specialEffects: {
          glow: "shadow-green-200",
          pattern: "floral",
        },
      }
    }

    if (month >= 6 && month <= 8) {
      return {
        season: "summer",
        name: "Verano",
        colors: {
          primary: "from-orange-500 to-yellow-500",
          secondary: "from-orange-50 to-yellow-50",
          accent: "text-orange-700",
          background: "from-orange-50 via-yellow-50 to-amber-50",
          decorative: ["bg-orange-200", "bg-yellow-200", "bg-amber-200", "bg-red-200"],
        },
        decorativeElements: [
          { type: "sun", count: 3, animation: "animate-spin" },
          { type: "wave", count: 4, animation: "animate-pulse" },
          { type: "palm", count: 2, animation: "animate-bounce" },
        ],
        specialEffects: {
          glow: "shadow-orange-200",
          pattern: "sunny",
        },
      }
    }

    if (month >= 9 && month <= 11) {
      return {
        season: "autumn",
        name: "Otoño",
        colors: {
          primary: "from-amber-600 to-orange-600",
          secondary: "from-amber-50 to-orange-50",
          accent: "text-amber-700",
          background: "from-amber-50 via-orange-50 to-red-50",
          decorative: ["bg-amber-200", "bg-orange-200", "bg-red-200", "bg-yellow-200"],
        },
        decorativeElements: [
          { type: "maple-leaf", count: 6, animation: "animate-bounce" },
          { type: "acorn", count: 3, animation: "animate-pulse" },
          { type: "pumpkin", count: 2, animation: "animate-pulse" },
        ],
        specialEffects: {
          glow: "shadow-amber-200",
          pattern: "autumn-leaves",
        },
      }
    }

    // Invierno (diciembre-febrero, excluyendo navidad) - Default fallback
    return {
      season: "winter",
      name: "Invierno",
      colors: {
        primary: "from-blue-600 to-cyan-600",
        secondary: "from-blue-50 to-cyan-50",
        accent: "text-blue-700",
        background: "from-blue-50 via-cyan-50 to-slate-50",
        decorative: ["bg-blue-200", "bg-cyan-200", "bg-slate-200", "bg-indigo-200"],
      },
      decorativeElements: [
        { type: "snowflake", count: 6, animation: "animate-spin" },
        { type: "icicle", count: 4, animation: "animate-pulse" },
        { type: "frost", count: 3, animation: "animate-ping" },
      ],
      specialEffects: {
        particles: true,
        glow: "shadow-blue-200",
        pattern: "winter",
      },
    }
  }, [])
}

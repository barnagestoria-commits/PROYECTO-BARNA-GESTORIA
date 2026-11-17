"use client"

import { useCallback, useEffect, useState } from "react"

const STORAGE_PREFIX = "taxlyn-exercise-year:"

export function exerciseYearOptions(anchorYear = new Date().getFullYear(), span = 5): number[] {
  const start = anchorYear - span
  const end = anchorYear + 1
  const years: number[] = []
  for (let y = start; y <= end; y += 1) years.push(y)
  return years
}

export function readStoredExerciseYear(companyId: string): number | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${companyId}`)
    if (!raw) return null
    const year = Number.parseInt(raw, 10)
    return Number.isFinite(year) ? year : null
  } catch {
    return null
  }
}

export function writeStoredExerciseYear(companyId: string, year: number): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${companyId}`, String(year))
  } catch {
    /* storage bloqueado */
  }
}

export function defaultDraftDateForExerciseYear(exerciseYear: number): string {
  const today = new Date()
  const calendarYear = today.getFullYear()
  if (exerciseYear < calendarYear) return `${exerciseYear}-12-31`
  if (exerciseYear > calendarYear) return `${exerciseYear}-01-01`
  return today.toISOString().split("T")[0]
}

export function useAccountingExerciseYear(companyId: string | undefined) {
  const calendarYear = new Date().getFullYear()
  const options = exerciseYearOptions(calendarYear)
  const [year, setYearState] = useState(calendarYear)

  useEffect(() => {
    if (!companyId) {
      setYearState(calendarYear)
      return
    }
    const stored = readStoredExerciseYear(companyId)
    setYearState(stored ?? calendarYear)
  }, [calendarYear, companyId])

  const setYear = useCallback(
    (next: number) => {
      setYearState(next)
      if (companyId) writeStoredExerciseYear(companyId, next)
    },
    [companyId],
  )

  return { year, setYear, options, calendarYear }
}
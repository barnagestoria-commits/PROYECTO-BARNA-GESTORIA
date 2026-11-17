"use client"

import { CalendarRange } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccountingExerciseYearSelectProps {
  year: number
  options: number[]
  onChange: (year: number) => void
  id?: string
  className?: string
  compact?: boolean
}

export function AccountingExerciseYearSelect({
  year,
  options,
  onChange,
  id = "accounting-exercise-year",
  className,
  compact,
}: AccountingExerciseYearSelectProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <CalendarRange className={cn("text-gray-500", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
      <label htmlFor={id} className={cn("font-medium", compact ? "text-xs text-graphite-600" : "text-sm")}>
        Ejercicio
      </label>
      <select
        id={id}
        value={year}
        onChange={(event) => onChange(Number.parseInt(event.target.value, 10))}
        className={cn(
          "rounded-md border border-input bg-background text-sm",
          compact ? "h-8 px-2 text-xs" : "h-9 px-3",
        )}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}
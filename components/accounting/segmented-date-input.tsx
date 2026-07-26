"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react"
import { cn } from "@/lib/utils"

type DateSegment = "day" | "month" | "year"

interface DateParts {
  day: string
  month: string
  year: string
}

export interface SegmentedDateInputProps {
  value: string
  onChange: (value: string) => void
  onFocus?: () => void
  onAdvance?: () => void
  inputRef?: (el: HTMLInputElement | null) => void
  className?: string
  "aria-label"?: string
}

function parseIsoParts(iso: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (match) {
    return { year: match[1], month: match[2], day: match[3] }
  }

  const date = new Date()
  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: String(date.getMonth() + 1).padStart(2, "0"),
    year: String(date.getFullYear()),
  }
}

function buildIso(parts: DateParts, fallback: string): string {
  const prev = parseIsoParts(fallback)
  const day = (parts.day || prev.day).padStart(2, "0").slice(-2)
  const month = (parts.month || prev.month).padStart(2, "0").slice(-2)
  // El año se escribe de izquierda a derecha; no rellenar con ceros a la izquierda mientras se edita.
  const year = parts.year.length === 4 ? parts.year : prev.year
  return `${year}-${month}-${day}`
}

function focusSegment(
  refs: Record<DateSegment, HTMLInputElement | null>,
  segment: DateSegment,
) {
  const el = refs[segment]
  el?.focus()
  el?.select()
}

function distributeDigits(raw: string, maxLength: number): { value: string; overflow: string } {
  const digits = raw.replace(/\D/g, "")
  return {
    value: digits.slice(0, maxLength),
    overflow: digits.slice(maxLength),
  }
}

const segmentInputClass =
  "h-full border-0 bg-transparent p-0 text-center font-mono tabular-nums outline-none focus:ring-0"

export function SegmentedDateInput({
  value,
  onChange,
  onFocus,
  onAdvance,
  inputRef,
  className,
  "aria-label": ariaLabel = "Fecha contable",
}: SegmentedDateInputProps) {
  const refs = useRef<Record<DateSegment, HTMLInputElement | null>>({
    day: null,
    month: null,
    year: null,
  })

  const [parts, setParts] = useState<DateParts>(() => parseIsoParts(value))
  const skipExternalSync = useRef(false)

  useEffect(() => {
    if (skipExternalSync.current) {
      skipExternalSync.current = false
      return
    }
    setParts(parseIsoParts(value))
  }, [value])

  const emitChange = useCallback(
    (nextParts: DateParts) => {
      skipExternalSync.current = true
      onChange(buildIso(nextParts, value))
    },
    [onChange, value],
  )

  const applyParts = useCallback(
    (nextParts: DateParts, focus?: DateSegment) => {
      setParts(nextParts)
      emitChange(nextParts)
      if (focus) {
        requestAnimationFrame(() => focusSegment(refs.current, focus))
      }
    },
    [emitChange],
  )

  const handleDayChange = (raw: string) => {
    const { value: day, overflow } = distributeDigits(raw, 2)
    if (!overflow) {
      applyParts({ ...parts, day }, day.length === 2 ? "month" : undefined)
      return
    }

    const monthChunk = distributeDigits(overflow, 2)
    if (!monthChunk.overflow) {
      applyParts(
        { ...parts, day, month: monthChunk.value },
        monthChunk.value.length === 2 ? "year" : "month",
      )
      return
    }

    const yearChunk = distributeDigits(monthChunk.overflow, 4)
    applyParts(
      { day, month: monthChunk.value, year: yearChunk.value },
      yearChunk.value.length === 4 ? "year" : "year",
    )
  }

  const handleMonthChange = (raw: string) => {
    const { value: month, overflow } = distributeDigits(raw, 2)
    if (!overflow) {
      applyParts({ ...parts, month }, month.length === 2 ? "year" : undefined)
      return
    }

    const yearChunk = distributeDigits(overflow, 4)
    applyParts({ ...parts, month, year: yearChunk.value }, "year")
  }

  const handleYearChange = (raw: string) => {
    const { value: year } = distributeDigits(raw, 4)
    applyParts({ ...parts, year })
  }

  const handleSegmentFocus = (_segment: DateSegment, event: FocusEvent<HTMLInputElement>) => {
    onFocus?.()
    event.target.select()
  }

  const handleSegmentKeyDown = (
    segment: DateSegment,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    const currentValue = parts[segment]

    if (event.key === "Tab") {
      if (event.shiftKey) {
        if (segment === "month") {
          event.preventDefault()
          focusSegment(refs.current, "day")
        } else if (segment === "year") {
          event.preventDefault()
          focusSegment(refs.current, "month")
        }
        return
      }

      if (segment === "day") {
        event.preventDefault()
        focusSegment(refs.current, "month")
        return
      }

      if (segment === "month") {
        event.preventDefault()
        focusSegment(refs.current, "year")
        return
      }

      event.preventDefault()
      onAdvance?.()
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      if (segment === "year") {
        onAdvance?.()
        return
      }
      focusSegment(refs.current, segment === "day" ? "month" : "year")
      return
    }

    if (event.key === "Backspace" && currentValue === "") {
      event.preventDefault()
      if (segment === "month") {
        focusSegment(refs.current, "day")
      } else if (segment === "year") {
        focusSegment(refs.current, "month")
      }
      return
    }

    if (/^\d$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const el = event.currentTarget
      const selectionStart = el.selectionStart ?? 0
      const selectionEnd = el.selectionEnd ?? 0
      const hasSelection = selectionStart !== selectionEnd
      const maxLength = segment === "year" ? 4 : 2
      const atMax = currentValue.length >= maxLength && !hasSelection

      if (atMax) {
        event.preventDefault()
        if (segment === "day") {
          handleDayChange(`${currentValue}${event.key}`)
        } else if (segment === "month") {
          handleMonthChange(`${currentValue}${event.key}`)
        }
      }
    }
  }

  const registerSegmentRef = (segment: DateSegment, el: HTMLInputElement | null) => {
    refs.current[segment] = el
    if (segment === "day") {
      inputRef?.(el)
    }
  }

  return (
    <div
      className={cn(
        "flex h-9 min-w-[9.5rem] items-center rounded-md border border-input bg-background px-1 text-xs ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className,
      )}
      aria-label={ariaLabel}
    >
      <input
        ref={(el) => registerSegmentRef("day", el)}
        type="text"
        inputMode="numeric"
        value={parts.day}
        onChange={(event) => handleDayChange(event.target.value)}
        onFocus={(event) => handleSegmentFocus("day", event)}
        onKeyDown={(event) => handleSegmentKeyDown("day", event)}
        className={cn(segmentInputClass, "w-6")}
        placeholder="dd"
        maxLength={2}
        aria-label="Día"
      />
      <span className="text-graphite-400 select-none">/</span>
      <input
        ref={(el) => registerSegmentRef("month", el)}
        type="text"
        inputMode="numeric"
        value={parts.month}
        onChange={(event) => handleMonthChange(event.target.value)}
        onFocus={(event) => handleSegmentFocus("month", event)}
        onKeyDown={(event) => handleSegmentKeyDown("month", event)}
        className={cn(segmentInputClass, "w-6")}
        placeholder="mm"
        maxLength={2}
        aria-label="Mes"
      />
      <span className="text-graphite-400 select-none">/</span>
      <input
        ref={(el) => registerSegmentRef("year", el)}
        type="text"
        inputMode="numeric"
        value={parts.year}
        onChange={(event) => handleYearChange(event.target.value)}
        onFocus={(event) => handleSegmentFocus("year", event)}
        onKeyDown={(event) => handleSegmentKeyDown("year", event)}
        className={cn(segmentInputClass, "w-10")}
        placeholder="aaaa"
        maxLength={4}
        aria-label="Año"
      />
    </div>
  )
}

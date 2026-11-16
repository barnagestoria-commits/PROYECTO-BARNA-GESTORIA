"use client"

import { useState, type KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { formatAmount, parseAmountInput } from "@/lib/reports/format"
import { cn } from "@/lib/utils"

interface SpanishAmountInputProps {
  value: number
  onChange: (amount: number) => void
  onFocus?: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  readOnly?: boolean
  tabIndex?: number
  className?: string
  placeholder?: string
  "aria-label"?: string
  inputRef?: (el: HTMLInputElement | null) => void
}

export function SpanishAmountInput({
  value,
  onChange,
  onFocus,
  onKeyDown,
  readOnly,
  tabIndex,
  className,
  placeholder = "0,00",
  "aria-label": ariaLabel,
  inputRef,
}: SpanishAmountInputProps) {
  const [draft, setDraft] = useState<string | null>(null)

  const display = draft !== null ? draft : value > 0 ? formatAmount(value) : ""

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={display}
      readOnly={readOnly}
      tabIndex={tabIndex}
      onFocus={() => {
        setDraft(value > 0 ? formatAmount(value) : "")
        onFocus?.()
      }}
      onChange={(event) => {
        if (readOnly) return
        const next = event.target.value
        setDraft(next)
        onChange(parseAmountInput(next))
      }}
      onBlur={() => {
        setDraft(null)
        if (value > 0) {
          onChange(value)
        }
      }}
      onKeyDown={onKeyDown}
      className={cn(className)}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  )
}
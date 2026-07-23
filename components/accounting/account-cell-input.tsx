"use client"

import { type KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { parseNewAccountPrefix, type NewAccountPrefix } from "@/lib/accounting/new-account-prefix"
import { normalizeCuenta } from "@/lib/reports/format"
import { cn } from "@/lib/utils"

interface AccountCellInputProps {
  value: string
  onChange: (value: string) => void
  onCreateAccountPrefix?: (prefix: NewAccountPrefix) => void
  onOpenAccountExtract?: (accountCode: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  onFocus?: () => void
  onBlur?: () => void
  onBeforeAdvance?: () => boolean | Promise<boolean>
  inputRef?: (el: HTMLInputElement | null) => void
  extractAccountCode?: string | null
  hasWarning?: boolean
  rowLabel: string
}

function isExtractCommand(value: string): boolean {
  return value.trim().toUpperCase() === "EX"
}

function isValidAccountCode(value: string): boolean {
  const digits = normalizeCuenta(value)
  return digits.length >= 2 && !isExtractCommand(value)
}

export function AccountCellInput({
  value,
  onChange,
  onCreateAccountPrefix,
  onOpenAccountExtract,
  onKeyDown,
  onFocus,
  onBlur,
  onBeforeAdvance,
  inputRef,
  extractAccountCode,
  hasWarning,
  rowLabel,
}: AccountCellInputProps) {
  const tryOpenExtract = (): boolean => {
    const accountCode = extractAccountCode ?? (isValidAccountCode(value) ? value : null)
    if (!accountCode) return false
    onOpenAccountExtract?.(accountCode)
    return true
  }

  const tryOpenCreateDialog = (): boolean => {
    const createPrefix = parseNewAccountPrefix(value)
    if (!createPrefix) return false
    onCreateAccountPrefix?.(createPrefix)
    return true
  }

  const handleKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    const isConfirmKey =
      event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)

    if (isConfirmKey && isExtractCommand(value)) {
      event.preventDefault()
      if (!tryOpenExtract()) {
        onKeyDown?.(event)
      }
      return
    }

    if (isConfirmKey && tryOpenCreateDialog()) {
      event.preventDefault()
      return
    }

    if (isConfirmKey && onBeforeAdvance) {
      event.preventDefault()
      const canAdvance = await onBeforeAdvance()
      if (canAdvance) {
        onKeyDown?.(event)
      }
      return
    }

    onKeyDown?.(event)
  }

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={() => onFocus?.()}
      onBlur={() => {
        void onBlur?.()
      }}
      onKeyDown={(event) => {
        void handleKeyDown(event)
      }}
      className={cn("h-9 font-mono", hasWarning && "border-amber-400")}
      placeholder="430 · 678+ · EX"
      aria-label={rowLabel}
      autoComplete="off"
    />
  )
}

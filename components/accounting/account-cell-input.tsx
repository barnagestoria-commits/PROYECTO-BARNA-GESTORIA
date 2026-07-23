"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { Input } from "@/components/ui/input"
import {
  inferThirdPartyPrefix,
  searchAccountSuggestions,
  type AccountSuggestion,
  type ThirdPartyAccountOption,
} from "@/lib/accounting/account-suggestions"
import type { LedgerSubaccountOption } from "@/lib/accounting/ledger-subaccount-types"
import { parseNewAccountPrefix, type NewAccountPrefix } from "@/lib/accounting/new-account-prefix"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { normalizeCuenta } from "@/lib/reports/format"
import { cn } from "@/lib/utils"

interface AccountCellInputProps {
  value: string
  onChange: (value: string) => void
  onSelectSuggestion?: (suggestion: AccountSuggestion) => void
  onCreateAccountPrefix?: (prefix: NewAccountPrefix) => void
  onOpenAccountExtract?: (accountCode: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  onFocus?: () => void
  onBlur?: () => void
  onBeforeAdvance?: () => boolean | Promise<boolean>
  inputRef?: (el: HTMLInputElement | null) => void
  thirdParties: ThirdPartyAccountOption[]
  ledgerSubaccounts?: LedgerSubaccountOption[]
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
  onSelectSuggestion,
  onCreateAccountPrefix,
  onOpenAccountExtract,
  onKeyDown,
  onFocus,
  onBlur,
  onBeforeAdvance,
  inputRef,
  thirdParties,
  ledgerSubaccounts = [],
  extractAccountCode,
  hasWarning,
  rowLabel,
}: AccountCellInputProps) {
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(
    () =>
      isExtractCommand(value)
        ? []
        : searchAccountSuggestions(value, thirdParties, ledgerSubaccounts, {
            preferPrefix: inferThirdPartyPrefix(value) ?? undefined,
            limit: 12,
          }),
    [ledgerSubaccounts, thirdParties, value],
  )

  useEffect(() => {
    setHighlightIndex(0)
  }, [value, suggestions.length])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const applySuggestion = (suggestion: AccountSuggestion) => {
    if (suggestion.source === "create" && suggestion.createPrefix) {
      onCreateAccountPrefix?.(suggestion.createPrefix)
      setOpen(false)
      return
    }

    onChange(formatAccountCodeDisplay(suggestion.code))
    onSelectSuggestion?.(suggestion)
    setOpen(false)
  }

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

    if (open && suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setHighlightIndex((current) => (current + 1) % suggestions.length)
        return
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        setHighlightIndex((current) => (current - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        applySuggestion(suggestions[highlightIndex])
        return
      }
      if (event.key === "Escape") {
        setOpen(false)
        return
      }
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
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(!isExtractCommand(event.target.value))
        }}
        onFocus={() => {
          onFocus?.()
          if (!isExtractCommand(value)) setOpen(true)
        }}
        onBlur={() => {
          setOpen(false)
          void onBlur?.()
        }}
        onKeyDown={(event) => {
          void handleKeyDown(event)
        }}
        className={cn("h-9 font-mono", hasWarning && "border-amber-400")}
        placeholder="430 · 678+ · EX"
        aria-label={rowLabel}
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        autoComplete="off"
      />

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-lg border border-sand-200 bg-white py-1 shadow-lg">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              className={cn(
                "flex w-full flex-col items-start px-3 py-2 text-left text-sm",
                suggestion.source === "create" && "border-b border-emerald-100",
                index === highlightIndex ? "bg-emerald-50 text-emerald-950" : "hover:bg-sand-50",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applySuggestion(suggestion)}
            >
              <span className="font-mono font-semibold">{suggestion.label}</span>
              {suggestion.subtitle && (
                <span className="text-xs text-graphite-500">{suggestion.subtitle}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

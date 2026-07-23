"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { List, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PgcChartDialog } from "@/components/accounting/pgc-chart-dialog"
import {
  NewSubaccountDialog,
  type AccountCreationResult,
} from "@/components/accounting/new-subaccount-dialog"
import { MissingAccountDialog } from "@/components/accounting/missing-account-dialog"
import { parseNewAccountPrefix } from "@/lib/accounting/new-account-prefix"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { normalizeAccountCodeDigits } from "@/lib/accounting/account-treatment-types"
import { apiFetch } from "@/lib/api-client"
import type { AccountExistenceResult } from "@/lib/accounting/account-exists-service"

interface CounterpartAccountPickerProps {
  value: string
  onChange: (accountCode: string) => void
  id?: string
}

function formatDisplayValue(value: string): string {
  const digits = normalizeAccountCodeDigits(value)
  if (!digits) return ""
  return formatAccountCodeDisplay(digits)
}

export function CounterpartAccountPicker({ value, onChange, id }: CounterpartAccountPickerProps) {
  const [pgcOpen, setPgcOpen] = useState(false)
  const [newPrefix, setNewPrefix] = useState<string | null>(null)
  const [fixedAccountCode, setFixedAccountCode] = useState<string | null>(null)
  const [missingAccount, setMissingAccount] = useState<AccountExistenceResult | null>(null)
  const [draft, setDraft] = useState(() => formatDisplayValue(value))
  const inputElRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setDraft(formatDisplayValue(value))
  }, [value])

  const commitDraft = (nextDraft: string) => {
    const digits = normalizeAccountCodeDigits(nextDraft)
    onChange(digits)
    setDraft(formatDisplayValue(digits))
  }

  const validateDraft = async (nextDraft: string): Promise<boolean> => {
    const digits = normalizeAccountCodeDigits(nextDraft)
    if (!digits || digits.length < 2 || parseNewAccountPrefix(nextDraft)) return true

    const year = new Date().getFullYear()
    try {
      const data = await apiFetch<{ success: true; year: number } & AccountExistenceResult>(
        `/api/accounting/accounts/exists?code=${encodeURIComponent(digits)}&year=${year}`,
      )
      if (data.exists) return true
      setMissingAccount(data)
      return false
    } catch {
      return true
    }
  }

  const tryOpenCreatePrefix = (raw: string) => {
    const prefix = parseNewAccountPrefix(raw.trim())
    if (prefix) {
      setFixedAccountCode(null)
      setNewPrefix(prefix)
      return true
    }
    return false
  }

  const handleKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "F4") {
      event.preventDefault()
      setPgcOpen(true)
      return
    }

    if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
      if (tryOpenCreatePrefix(draft)) {
        event.preventDefault()
        return
      }
      event.preventDefault()
      commitDraft(draft)
      const ok = await validateDraft(draft)
      if (!ok) return
    }
  }

  const handleBlur = async () => {
    commitDraft(draft)
    await validateDraft(draft)
  }

  const handleSubaccountCreated = (result: AccountCreationResult) => {
    commitDraft(result.resolution.accountCode)
  }

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <Input
            id={id}
            ref={inputElRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void handleBlur()}
            onKeyDown={(event) => void handleKeyDown(event)}
            placeholder="626+ · F4 plan contable · 60700000"
            className="font-mono"
            aria-label="Contrapartida habitual"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setPgcOpen(true)}
            title="F4 · Plan contable completo"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => {
              if (!tryOpenCreatePrefix(draft)) {
                setFixedAccountCode(null)
                setNewPrefix("626")
              }
            }}
            title="Alta subcuenta (626+, 607+, 629+…)"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-graphite-500">
          F4 o lista para elegir del plan contable · escribe <span className="font-mono">626+</span> y
          Enter para crear subcuenta
        </p>
      </div>

      <PgcChartDialog
        open={pgcOpen}
        onClose={() => setPgcOpen(false)}
        onSelect={(accountCode) => {
          commitDraft(accountCode)
          setPgcOpen(false)
        }}
      />

      <NewSubaccountDialog
        open={newPrefix !== null}
        prefix={newPrefix}
        fixedAccountCode={fixedAccountCode}
        onClose={() => {
          setNewPrefix(null)
          setFixedAccountCode(null)
        }}
        onCreated={(result) => {
          handleSubaccountCreated(result)
          setNewPrefix(null)
          setFixedAccountCode(null)
        }}
      />

      <MissingAccountDialog
        open={missingAccount !== null}
        year={new Date().getFullYear()}
        account={missingAccount}
        onConfirm={() => {
          if (!missingAccount?.parentCode) return
          setFixedAccountCode(missingAccount.accountCode)
          setNewPrefix(missingAccount.parentCode)
          setMissingAccount(null)
        }}
        onCancel={() => {
          setMissingAccount(null)
          requestAnimationFrame(() => {
            inputElRef.current?.focus()
            inputElRef.current?.select()
          })
        }}
      />
    </>
  )
}

"use client"

import { useEffect, useState, type KeyboardEvent } from "react"
import { List, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PgcChartDialog } from "@/components/accounting/pgc-chart-dialog"
import {
  NewSubaccountDialog,
  type AccountCreationResult,
} from "@/components/accounting/new-subaccount-dialog"
import { parseNewAccountPrefix } from "@/lib/accounting/new-account-prefix"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { normalizeAccountCodeDigits } from "@/lib/accounting/account-treatment-types"

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
  const [draft, setDraft] = useState(() => formatDisplayValue(value))

  useEffect(() => {
    setDraft(formatDisplayValue(value))
  }, [value])

  const commitDraft = (nextDraft: string) => {
    const digits = normalizeAccountCodeDigits(nextDraft)
    onChange(digits)
    setDraft(formatDisplayValue(digits))
  }

  const tryOpenCreatePrefix = (raw: string) => {
    const prefix = parseNewAccountPrefix(raw.trim())
    if (prefix) {
      setNewPrefix(prefix)
      return true
    }
    return false
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "F4") {
      event.preventDefault()
      setPgcOpen(true)
      return
    }

    if (event.key === "Enter") {
      if (tryOpenCreatePrefix(draft)) {
        event.preventDefault()
        return
      }
      commitDraft(draft)
    }
  }

  const handleSubaccountCreated = (result: AccountCreationResult) => {
    const accountCode =
      result.kind === "ledger"
        ? result.resolution.accountCode
        : result.resolution.accountCode
    commitDraft(accountCode)
  }

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <Input
            id={id}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => commitDraft(draft)}
            onKeyDown={handleKeyDown}
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
        onClose={() => setNewPrefix(null)}
        onCreated={(result) => {
          handleSubaccountCreated(result)
          setNewPrefix(null)
        }}
      />
    </>
  )
}

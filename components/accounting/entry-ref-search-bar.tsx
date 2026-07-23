"use client"

import { useEffect, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { apiFetch } from "@/lib/api-client"
import { formatEuro } from "@/lib/accounting/command-templates"
import type { EntryRefSummary } from "@/lib/accounting/entry-ref-service"

interface EntryRefSearchBarProps {
  onOpenEntry: (entryId: string) => void
  refreshKey?: number
}

export function EntryRefSearchBar({ onOpenEntry, refreshKey = 0 }: EntryRefSearchBarProps) {
  const [fromRef, setFromRef] = useState("")
  const [toRef, setToRef] = useState("")
  const [nextRefNumber, setNextRefNumber] = useState<number | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultsOpen, setResultsOpen] = useState(false)
  const [results, setResults] = useState<EntryRefSummary[]>([])

  useEffect(() => {
    let cancelled = false

    apiFetch<{ success: true; nextRefNumber: number; entries: EntryRefSummary[] }>(
      "/api/accounting/entries/search?last=true",
    )
      .then((data) => {
        if (!cancelled) setNextRefNumber(data.nextRefNumber)
      })
      .catch(() => {
        if (!cancelled) setNextRefNumber(1)
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const runSearch = async (options: { last?: boolean; from?: string; to?: string }) => {
    setIsSearching(true)
    setError(null)

    try {
      let url = "/api/accounting/entries/search?"
      if (options.last) {
        url += "last=true"
      } else {
        const from = options.from?.trim() || fromRef.trim()
        const to = options.to?.trim() || toRef.trim() || from
        if (!from) {
          setError("Indica el número de ref. desde.")
          return
        }
        url += `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      }

      const data = await apiFetch<{
        success: true
        entries: EntryRefSummary[]
        nextRefNumber: number
      }>(url)

      setNextRefNumber(data.nextRefNumber)

      if (data.entries.length === 0) {
        setError("No se encontraron asientos con esos números de ref.")
        setResults([])
        setResultsOpen(false)
        return
      }

      if (data.entries.length === 1) {
        onOpenEntry(data.entries[0].id)
        return
      }

      setResults(data.entries)
      setResultsOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo buscar el asiento.")
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <>
      <div className="rounded-lg border border-sand-200 bg-sand-50/80 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-emerald-900">Búsqueda por Nº Ref.</p>
            {nextRefNumber !== null && (
              <p className="text-xs text-graphite-600">
                Próximo asiento: <span className="font-mono font-semibold">{nextRefNumber}</span>
              </p>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isSearching}
            onClick={() => runSearch({ last: true })}
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Último asiento"
            )}
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="ref-from" className="text-xs">
              Desde Ref.
            </Label>
            <Input
              id="ref-from"
              value={fromRef}
              onChange={(event) => setFromRef(event.target.value.replace(/\D/g, ""))}
              placeholder="1"
              className="h-9 font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ref-to" className="text-xs">
              Hasta Ref.
            </Label>
            <Input
              id="ref-to"
              value={toRef}
              onChange={(event) => setToRef(event.target.value.replace(/\D/g, ""))}
              placeholder="Igual que desde"
              className="h-9 font-mono"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 bg-emerald-800 hover:bg-pine-900"
            disabled={isSearching}
            onClick={() => runSearch({})}
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Search className="mr-1 h-4 w-4" />
                Buscar
              </>
            )}
          </Button>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>

      <AccountingModal
        open={resultsOpen}
        title="Resultados de búsqueda"
        subtitle="Selecciona un asiento para abrirlo"
        onClose={() => setResultsOpen(false)}
        className="max-w-3xl"
      >
        <div className="max-h-[360px] overflow-auto rounded-lg border border-sand-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-sand-100 text-left text-xs uppercase tracking-wide text-graphite-600">
              <tr>
                <th className="px-3 py-2">Ref.</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Concepto</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {results.map((entry) => (
                <tr
                  key={entry.id}
                  className="cursor-pointer border-t border-sand-100 hover:bg-emerald-50"
                  onClick={() => {
                    onOpenEntry(entry.id)
                    setResultsOpen(false)
                  }}
                >
                  <td className="px-3 py-2 font-mono font-semibold">{entry.refNumber}</td>
                  <td className="px-3 py-2 font-mono text-xs">{entry.fecha}</td>
                  <td className="px-3 py-2">{entry.concepto ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{entry.commandCode ?? "Manual"}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatEuro(entry.totalDebe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AccountingModal>
    </>
  )
}

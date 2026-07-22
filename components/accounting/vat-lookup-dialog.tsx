"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { cn } from "@/lib/utils"

interface LookupColumn<T> {
  key: keyof T | string
  header: string
  className?: string
  render?: (item: T) => string
}

interface VatLookupDialogProps<T extends { code: string }> {
  open: boolean
  title: string
  subtitle?: string
  items: T[]
  columns: LookupColumn<T>[]
  getDescription: (item: T) => string
  onClose: () => void
  onSelect: (item: T) => void
}

export function VatLookupDialog<T extends { code: string }>({
  open,
  title,
  subtitle,
  items,
  columns,
  getDescription,
  onClose,
  onSelect,
}: VatLookupDialogProps<T>) {
  const [query, setQuery] = useState("")
  const [selectedCode, setSelectedCode] = useState<string | null>(items[0]?.code ?? null)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter((item) =>
      Object.values(item as Record<string, unknown>).some((value) =>
        String(value).toLowerCase().includes(normalized),
      ),
    )
  }, [items, query])

  const selected =
    filtered.find((item) => item.code === selectedCode) ?? filtered[0] ?? null

  const handleAccept = () => {
    if (selected) onSelect(selected)
  }

  return (
    <AccountingModal
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      className="max-w-4xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar..."
            className="max-w-xs"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-emerald-800 hover:bg-pine-900"
              disabled={!selected}
              onClick={handleAccept}
            >
              Aceptar
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="max-h-[360px] overflow-auto rounded-lg border border-sand-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-sand-100 text-left text-xs uppercase tracking-wide text-graphite-600">
              <tr>
                {columns.map((column) => (
                  <th key={String(column.key)} className={cn("px-3 py-2", column.className)}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.code}
                  className={cn(
                    "cursor-pointer border-t border-sand-100 hover:bg-emerald-50",
                    selected?.code === item.code && "bg-emerald-50",
                  )}
                  onClick={() => setSelectedCode(item.code)}
                  onDoubleClick={() => onSelect(item)}
                >
                  {columns.map((column) => (
                    <td key={String(column.key)} className={cn("px-3 py-2", column.className)}>
                      {column.render
                        ? column.render(item)
                        : String((item as Record<string, unknown>)[column.key as string] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-sand-200 bg-sand-50 p-3 text-sm text-graphite-700">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-graphite-500">
            <Search className="h-3.5 w-3.5" />
            Descripción
          </div>
          <p className="leading-relaxed">
            {selected ? getDescription(selected) : "Selecciona un elemento de la lista."}
          </p>
        </div>
      </div>
    </AccountingModal>
  )
}

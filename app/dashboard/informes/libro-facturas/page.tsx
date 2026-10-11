"use client"

import { useMemo, useState } from "react"
import { BookOpen, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api-client"
import type { InvoiceRegisterListing } from "@/lib/reports/invoice-register"

function currentQuarterRange(): { from: string; to: string } {
  const now = new Date()
  const year = now.getFullYear()
  const quarter = Math.floor(now.getMonth() / 3)
  const starts = ["01-01", "04-01", "07-01", "10-01"]
  const ends = ["03-31", "06-30", "09-30", "12-31"]
  return { from: `${year}-${starts[quarter]}`, to: `${year}-${ends[quarter]}` }
}

function money(value: number): string {
  return value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function LibroFacturasPage() {
  const initial = useMemo(() => currentQuarterRange(), [])
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [book, setBook] = useState("ambas")
  const [withTotal, setWithTotal] = useState(true)
  const [splitRect, setSplitRect] = useState(true)
  const [splitOp, setSplitOp] = useState(true)
  const [listing, setListing] = useState<InvoiceRegisterListing | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const query = new URLSearchParams({
    from,
    to,
    book,
    totals: withTotal ? "1" : "0",
    splitRect: splitRect ? "1" : "0",
    splitOp: splitOp ? "1" : "0",
  })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch<{ success: boolean; listing: InvoiceRegisterListing }>(
        `/api/reports/libro-facturas?${query.toString()}`,
      )
      setListing(response.listing)
    } catch (loadError) {
      setListing(null)
      setError(loadError instanceof Error ? loadError.message : "No se pudo generar el listado.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Card className="border-sand-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-emerald-700" />
            <div>
              <CardTitle className="text-lg text-pine-900">Libro registro de facturas</CardTitle>
              <CardDescription>
                Desglose de IVA de las facturas emitidas y recibidas. El Excel separa rectificativas y tipo de operación.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="libro-desde">Desde</Label>
              <Input id="libro-desde" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="libro-hasta">Hasta</Label>
              <Input id="libro-hasta" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="libro-tipo">Libro</Label>
              <select
                id="libro-tipo"
                className="flex h-10 w-full rounded-md border border-sand-300 bg-white px-3 text-sm text-pine-900"
                value={book}
                onChange={(event) => setBook(event.target.value)}
              >
                <option value="ambas">Emitidas y recibidas</option>
                <option value="emitidas">Facturas emitidas</option>
                <option value="recibidas">Facturas recibidas</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm text-pine-900">
              <input type="checkbox" checked={withTotal} onChange={(event) => setWithTotal(event.target.checked)} />
              Formato con total factura
            </label>
            <label className="flex items-center gap-2 text-sm text-pine-900">
              <input type="checkbox" checked={splitRect} onChange={(event) => setSplitRect(event.target.checked)} />
              Separar facturas y rectificativas
            </label>
            <label className="flex items-center gap-2 text-sm text-pine-900">
              <input type="checkbox" checked={splitOp} onChange={(event) => setSplitOp(event.target.checked)} />
              Separar por tipo de operación
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Listar
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href={`/api/reports/libro-facturas?${query.toString()}&format=xlsx`}>
                <Download className="mr-2 h-4 w-4" />
                Descargar Excel
              </a>
            </Button>
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </CardContent>
      </Card>

      {listing && listing.sections.length === 0 ? (
        <p className="text-sm text-graphite-500">No hay facturas con IVA en el periodo seleccionado.</p>
      ) : null}

      {listing?.sections.map((section) => (
        <Card key={`${section.book}-${section.title}`} className="border-sand-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-pine-900">{section.title}</CardTitle>
            <CardDescription>
              {section.rows.length} líneas · Base {money(section.base)} € · IVA {money(section.vatQuota)} €
              {withTotal ? ` · Total ${money(section.total)} €` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-sand-200 text-xs uppercase tracking-wide text-graphite-500">
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-2 py-2 font-medium">Número</th>
                  <th className="px-2 py-2 font-medium">Tercero</th>
                  <th className="px-2 py-2 font-medium">NIF</th>
                  <th className="px-2 py-2 text-right font-medium">Base</th>
                  <th className="px-2 py-2 text-right font-medium">% IVA</th>
                  <th className="px-2 py-2 text-right font-medium">Cuota</th>
                  {withTotal ? <th className="px-2 py-2 text-right font-medium">Total</th> : null}
                </tr>
              </thead>
              <tbody>
                {section.rows.length === 0 ? (
                  <tr>
                    <td colSpan={withTotal ? 8 : 7} className="px-2 py-4 text-graphite-500">
                      No hay facturas en este tramo.
                    </td>
                  </tr>
                ) : (
                  section.rows.map((row, index) => (
                    <tr key={`${row.number}-${row.isoDate}-${index}`} className="border-b border-sand-100">
                      <td className="px-2 py-2 whitespace-nowrap">{row.date}</td>
                      <td className="px-2 py-2">{row.number || "—"}</td>
                      <td className="px-2 py-2">{row.party || "—"}</td>
                      <td className="px-2 py-2">{row.nif || "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{money(row.base)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.vatRate}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{money(row.vatQuota)}</td>
                      {withTotal ? (
                        <td className="px-2 py-2 text-right tabular-nums">{money(row.total)}</td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

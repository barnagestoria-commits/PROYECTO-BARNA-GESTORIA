"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRequireAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api-client"
import type { SiiBook, SiiInvoiceDraft } from "@/lib/fiscal/sii/types"

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

function euro(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value)
}

export function SiiBooksPage() {
  const { activeCompany } = useRequireAuth()
  const sii = activeCompany?.siiMode === "OBLIGATORIO" || activeCompany?.siiMode === "VOLUNTARIO"
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [invoices, setInvoices] = useState<SiiInvoiceDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox")
  const [sending, setSending] = useState<SiiBook | null>(null)

  const load = useCallback(async () => {
    if (!sii) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ success: true; invoices: SiiInvoiceDraft[] }>(
        `/api/fiscal/sii/books?year=${year}&month=${month}`,
      )
      setInvoices(data.invoices)
    } catch (err) {
      setInvoices([])
      setError(err instanceof Error ? err.message : "No se han podido cargar los libros.")
    } finally {
      setLoading(false)
    }
  }, [month, sii, year])

  useEffect(() => {
    void load()
  }, [load])

  const send = async (book: SiiBook) => {
    setSending(book)
    setError(null)
    setNotice(null)
    try {
      const result = await apiFetch<{ success: true; sent: number; accepted: number; rejected: number }>(
        "/api/fiscal/sii/submit",
        {
          method: "POST",
          body: JSON.stringify({ year, month, book, environment }),
        },
      )
      setNotice(
        `Enviadas ${result.sent}. Aceptadas ${result.accepted}. Rechazadas ${result.rejected}.`,
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido enviar el libro.")
    } finally {
      setSending(null)
    }
  }

  if (!activeCompany) return null
  if (!sii) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-graphite-600">
          Los libros del SII aparecen cuando la empresa tiene el SII marcado en su ficha, junto al CNAE.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="text-emerald-900">Libros del SII</CardTitle>
          <CardDescription>
            Facturas emitidas y recibidas del mes. Se firman con el certificado digital guardado de{" "}
            {activeCompany.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Ejercicio</Label>
            <Input
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="w-28"
            />
          </div>
          <div className="space-y-1">
            <Label>Mes</Label>
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {MONTHS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-graphite-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando facturas…
        </div>
      ) : (
        <>
          <BookTable title="Facturas emitidas" book="EMITIDAS" invoices={invoices} onSend={send} sending={sending} />
          <BookTable title="Facturas recibidas" book="RECIBIDAS" invoices={invoices} onSend={send} sending={sending} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certificado para el envío</CardTitle>
          <CardDescription>
            Se usa el .p12 cifrado de la empresa. El entorno de pruebas no presenta el libro real.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Entorno</Label>
            <select
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as "sandbox" | "production")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="sandbox">Pruebas de Hacienda</option>
              <option value="production">Producción</option>
            </select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BookTable({
  title,
  book,
  invoices,
  onSend,
  sending,
}: {
  title: string
  book: SiiBook
  invoices: SiiInvoiceDraft[]
  onSend: (book: SiiBook) => void
  sending: SiiBook | null
}) {
  const rows = invoices.filter((invoice) => invoice.book === book)
  const ready = rows.filter((invoice) => invoice.status === "LISTA" || invoice.status === "RECHAZADA").length
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>
            {rows.length} facturas · {ready} pendientes de envío
          </CardDescription>
        </div>
        <Button type="button" size="sm" disabled={ready === 0 || sending !== null} onClick={() => onSend(book)}>
          {sending === book ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Enviar a Hacienda
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-graphite-500">
            <tr>
              <th className="py-2 pr-3">Factura</th>
              <th className="py-2 pr-3">Fecha</th>
              <th className="py-2 pr-3">NIF</th>
              <th className="py-2 pr-3">Total</th>
              <th className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-graphite-500">
                  No hay facturas de este libro en el mes.
                </td>
              </tr>
            ) : (
              rows.map((invoice) => (
                <tr key={invoice.invoiceKey} className="border-t border-sand-200">
                  <td className="py-2 pr-3 font-medium">{invoice.numero || "—"}</td>
                  <td className="py-2 pr-3">{invoice.fechaExpedicion || "—"}</td>
                  <td className="py-2 pr-3">{invoice.nif || "—"}</td>
                  <td className="py-2 pr-3">{euro(invoice.importeTotal)}</td>
                  <td className="py-2">
                    {invoice.status === "ACEPTADA"
                      ? `Aceptada${invoice.csv ? ` · ${invoice.csv}` : ""}`
                      : invoice.status === "RECHAZADA"
                        ? invoice.errorMessage || "Rechazada"
                        : invoice.blockedReason || "Lista"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"

type PagoEstado = "pendiente" | "aprobado" | "rechazado"
type Filter = "pendiente" | "aprobado" | "todos"

interface AdminPayment {
  id: string
  estado: PagoEstado
  fecha: string
  fileName: string
  contentType: string
  byteSize: number
  previewUrl: string
  repeatedByOthers: boolean
  user: { id: string; name: string; email: string; accountName: string; isActive: boolean }
}

interface BankDetails {
  iban: string
  ibanDisplay: string
  beneficiary: string
  bankName: string | null
  instructions: string | null
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "pendiente", label: "Pendientes" },
  { id: "aprobado", label: "Aprobados" },
  { id: "todos", label: "Todos" },
]

const inputClass =
  "h-11 w-full rounded-lg border border-sand-300 bg-white px-3 text-base text-pine-950 outline-none ring-emerald-700/30 focus:ring-2"

function BankSettingsCard() {
  const [bank, setBank] = useState<BankDetails | null>(null)
  const [form, setForm] = useState({ iban: "", beneficiary: "", bankName: "", instructions: "" })
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const fill = useCallback((value: BankDetails) => {
    setBank(value)
    setForm({
      iban: value.ibanDisplay,
      beneficiary: value.beneficiary,
      bankName: value.bankName ?? "",
      instructions: value.instructions ?? "",
    })
  }, [])

  useEffect(() => {
    apiFetch<{ bank: BankDetails }>("/api/admin/pagos/ajustes-bancarios")
      .then((data) => fill(data.bank))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se han podido cargar los datos bancarios."))
  }, [fill])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const data = await apiFetch<{ bank: BankDetails }>("/api/admin/pagos/ajustes-bancarios", {
        method: "PUT",
        body: JSON.stringify(form),
      })
      fill(data.bank)
      setEditing(false)
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se han podido guardar los datos.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-pine-950">Datos bancarios que ven los clientes</h2>
          {bank && !editing ? (
            <p className="mt-1 break-all text-sm text-graphite-700">
              <span className="font-mono font-semibold">{bank.ibanDisplay}</span> · {bank.beneficiary}
              {bank.bankName ? ` · ${bank.bankName}` : ""}
            </p>
          ) : null}
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => {
              setEditing(true)
              setSaved(false)
            }}
            disabled={!bank}
            className="h-10 rounded-lg border border-sand-300 px-4 text-sm font-semibold text-pine-900 hover:bg-sand-50 disabled:opacity-60"
          >
            Editar
          </button>
        ) : null}
      </div>

      {saved ? <p className="mt-2 text-sm text-emerald-800">Datos guardados. Ya los ven los clientes.</p> : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {editing ? (
        <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-graphite-700 sm:col-span-2">
            IBAN
            <input className={cn(inputClass, "font-mono")} value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} required />
          </label>
          <label className="block text-sm text-graphite-700">
            Nombre del beneficiario
            <input className={inputClass} value={form.beneficiary} onChange={(e) => setForm({ ...form, beneficiary: e.target.value })} required maxLength={100} />
          </label>
          <label className="block text-sm text-graphite-700">
            Banco (opcional)
            <input className={inputClass} value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} maxLength={70} />
          </label>
          <label className="block text-sm text-graphite-700 sm:col-span-2">
            Indicaciones extra para el cliente (opcional)
            <textarea
              className={cn(inputClass, "h-24 py-2")}
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              maxLength={500}
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                if (bank) fill(bank)
                setEditing(false)
                setError(null)
              }}
              className="h-10 rounded-lg border border-sand-300 px-4 text-sm font-semibold text-graphite-700 hover:bg-sand-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

function ProofPreview({ payment }: { payment: AdminPayment }) {
  const isImage = payment.contentType.startsWith("image/")
  return (
    <a
      href={payment.previewUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2 text-sm font-medium text-emerald-900 hover:underline"
      title="Abrir el justificante en una pestaña nueva"
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={payment.previewUrl}
          alt={`Justificante de ${payment.user.name}`}
          loading="lazy"
          className="h-16 w-16 rounded-lg border border-sand-300 object-cover"
        />
      ) : (
        <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-sand-300 bg-sand-50">
          <FileText className="h-6 w-6 text-graphite-500" />
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        {isImage ? "Ver" : "Abrir PDF"} <ExternalLink className="h-3.5 w-3.5" />
      </span>
    </a>
  )
}

export function PaymentsAdminPanel() {
  const { session, isLoading } = useAuth()
  const isOperator = Boolean(session?.user.isPlatformOperator)
  const [filter, setFilter] = useState<Filter>("pendiente")
  const [payments, setPayments] = useState<AdminPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const load = useCallback(async (next: Filter) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ payments: AdminPayment[] }>(`/api/admin/pagos?estado=${next}`)
      setPayments(data.payments)
    } catch (cause) {
      setPayments([])
      setError(cause instanceof Error ? cause.message : "No se han podido cargar los pagos.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoading && isOperator) void load(filter)
  }, [isLoading, isOperator, filter, load])

  async function approve(payment: AdminPayment) {
    const confirmed = window.confirm(
      `¿Aprobar el pago de ${payment.user.name} (${payment.user.email})?\n\nSe activará su cuenta.`,
    )
    if (!confirmed) return
    setApprovingId(payment.id)
    setError(null)
    try {
      await apiFetch(`/api/admin/pagos/${payment.id}/aprobar`, { method: "POST" })
      await load(filter)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido aprobar el pago.")
    } finally {
      setApprovingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    )
  }

  if (!isOperator) {
    return (
      <p className="rounded-xl border border-sand-200 bg-white p-4 text-sm text-graphite-600">
        Esta pantalla es solo para el operador de Taxlyn.
      </p>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-pine-950">Pagos por transferencia</h1>
        <p className="mt-1 text-sm text-graphite-600">
          Comprueba en el banco que ha entrado el importe con la referencia del cliente y aprueba el pago para activar su cuenta.
        </p>
      </div>

      <BankSettingsCard />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Estado de los pagos">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              "h-10 rounded-lg border px-4 text-sm font-semibold",
              filter === item.id
                ? "border-emerald-800 bg-emerald-800 text-white"
                : "border-sand-300 bg-white text-graphite-700 hover:bg-sand-50",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
        </div>
      ) : payments.length === 0 ? (
        <p className="rounded-xl border border-sand-200 bg-white p-4 text-sm text-graphite-600">
          {filter === "pendiente" ? "No hay pagos pendientes de revisar." : "No hay pagos con este filtro."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-white">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-sand-200 bg-sand-50 text-xs uppercase tracking-wide text-graphite-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Justificante</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-graphite-700">
                    {new Date(payment.fecha).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-pine-950">{payment.user.name}</p>
                    <p className="text-graphite-600">{payment.user.email}</p>
                    <p className="mt-0.5 break-all font-mono text-xs text-graphite-500">Ref. {payment.user.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <ProofPreview payment={payment} />
                    {payment.repeatedByOthers ? (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5" /> Este archivo ya lo subió otro usuario
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        payment.estado === "aprobado" && "bg-emerald-100 text-emerald-900",
                        payment.estado === "pendiente" && "bg-amber-100 text-amber-900",
                        payment.estado === "rechazado" && "bg-red-100 text-red-800",
                      )}
                    >
                      {payment.estado === "pendiente" ? "Pendiente" : payment.estado === "aprobado" ? "Aprobado" : "Rechazado"}
                    </span>
                    <p className="mt-1 text-xs text-graphite-500">{payment.user.isActive ? "Cuenta activa" : "Cuenta sin activar"}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {payment.estado === "pendiente" ? (
                      <button
                        type="button"
                        onClick={() => void approve(payment)}
                        disabled={approvingId === payment.id}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
                      >
                        {approvingId === payment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Aprobar pago
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

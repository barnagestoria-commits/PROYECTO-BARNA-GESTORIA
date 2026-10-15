"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  defaultModel303ExportPayment,
  formatModel303DirectDebitDeadline,
  isModel303DirectDebitOpen,
  isValidNrc,
  normalizeNrc,
  type Model303ExportPayment,
} from "@/lib/fiscal/model-303/export-payment"
import { formatIbanDisplay } from "@/lib/banking/iban"

interface Model303DownloadDialogProps {
  open: boolean
  resultAmount: number
  year: number
  quarter: string | number
  taxDirectDebitIban?: string | null
  taxDirectDebitBank?: string | null
  onConfirm: (payment: Model303ExportPayment) => void
  onCancel: () => void
}

const PAYMENT_OPTIONS: Array<{ id: Model303ExportPayment; label: string }> = [
  { id: "solicitud_nrc", label: "Solicitud de NRC" },
  { id: "nrc_obtenido", label: "NRC ya obtenido por el cliente" },
  { id: "domiciliacion", label: "Domiciliación bancaria" },
  { id: "entidad_colaboradora", label: "Presentación a través de entidad colaboradora" },
  { id: "aplazamiento", label: "Solicitud de aplazamiento" },
]

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amount)
}

export function Model303DownloadDialog({
  open,
  resultAmount,
  year,
  quarter,
  taxDirectDebitIban,
  taxDirectDebitBank,
  onConfirm,
  onCancel,
}: Model303DownloadDialogProps) {
  const periodQuarter = quarter === "annual" || quarter === "anual" ? "annual" : Number(quarter)
  const period = { year, quarter: periodQuarter }
  const directDebitOpen = isModel303DirectDebitOpen(period)
  const directDebitDeadline = formatModel303DirectDebitDeadline(year, periodQuarter)
  const ibanDisplay = formatIbanDisplay(taxDirectDebitIban)
  const hasIban = Boolean((taxDirectDebitIban ?? "").replace(/\s/g, ""))
  const [payment, setPayment] = useState<Model303ExportPayment>(() =>
    defaultModel303ExportPayment(resultAmount, period, hasIban),
  )
  const [nrc, setNrc] = useState("")
  const [nrcError, setNrcError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPayment(defaultModel303ExportPayment(resultAmount, period, hasIban))
    setNrc("")
    setNrcError(null)
  }, [open, resultAmount, year, quarter, hasIban])

  if (!open) return null

  const toPay = resultAmount > 0.005
  const toCompensate = resultAmount < -0.005

  const confirm = async () => {
    if (toPay && payment === "nrc_obtenido" && !isValidNrc(nrc)) {
      setNrcError("El NRC tiene 22 caracteres, letras y números.")
      return
    }
    if (toPay && payment === "nrc_obtenido") {
      const compact = normalizeNrc(nrc)
      try {
        await navigator.clipboard.writeText(compact)
      } catch {
        // El NRC sigue visible en el campo para copiarlo a mano.
      }
    }
    onConfirm(payment)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="model303-download-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-black bg-white shadow-xl"
      >
        <div className="border-b border-black bg-[#1a4480] px-4 py-3 text-white">
          <h2 id="model303-download-title" className="text-sm font-bold">
            Elegir la forma de pago
          </h2>
          <p className="mt-1 text-xs text-white/85">
            Indica el método que utilizarás para el pago de la liquidación. Resultado del periodo:{" "}
            <span className="font-semibold">{formatEuro(resultAmount)}</span>
          </p>
        </div>

        <div className="space-y-3 p-4">
          {toPay ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="model303-payment-method" className="text-xs font-semibold uppercase tracking-wide text-graphite-500">
                  Forma
                </Label>
                <select
                  id="model303-payment-method"
                  className="h-10 w-full rounded-md border border-sand-300 bg-white px-3 text-sm text-pine-900"
                  value={payment}
                  onChange={(event) => {
                    setPayment(event.target.value as Model303ExportPayment)
                    setNrcError(null)
                  }}
                >
                  {PAYMENT_OPTIONS.map((option) => (
                    <option
                      key={option.id}
                      value={option.id}
                      disabled={option.id === "domiciliacion" && !directDebitOpen}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-md border border-sand-200 bg-sand-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-graphite-500">Descripción</p>
                <p className="mt-1 text-sm leading-relaxed text-graphite-700">
                  <PaymentDescription
                    payment={payment}
                    directDebitOpen={directDebitOpen}
                    directDebitDeadline={directDebitDeadline}
                    hasIban={hasIban}
                    ibanDisplay={ibanDisplay}
                    bank={taxDirectDebitBank}
                  />
                </p>
              </div>

              {!directDebitOpen && directDebitDeadline ? (
                <p className="text-xs leading-relaxed text-graphite-600">
                  La domiciliación bancaria ya no está disponible: el plazo terminó el {directDebitDeadline}.
                  La presentación con ese método debe hacerse, como norma general, antes del día 15 del mes
                  siguiente al periodo (día 25 de enero en el cuarto trimestre).
                </p>
              ) : null}

              {payment === "nrc_obtenido" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="model303-nrc">NRC del cliente</Label>
                  <Input
                    id="model303-nrc"
                    value={nrc}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="22 caracteres"
                    onChange={(event) => {
                      setNrc(event.target.value.toUpperCase())
                      setNrcError(null)
                    }}
                  />
                  {nrcError ? <p className="text-xs text-red-700">{nrcError}</p> : null}
                </div>
              ) : null}

              {payment === "domiciliacion" && directDebitOpen && !hasIban ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <Link href="/configuracion" className="font-medium underline">
                    Ir a Configuración → Perfil
                  </Link>{" "}
                  y completa la cuenta de domiciliación de impuestos.
                </p>
              ) : null}
            </>
          ) : null}

          {toCompensate ? (
            <div className="rounded-md border border-sand-200 bg-sand-50 px-3 py-2 text-sm leading-relaxed text-graphite-700">
              El resultado es a compensar. El fichero se genera para compensar en autoliquidaciones posteriores.
            </div>
          ) : null}

          {!toPay && !toCompensate ? (
            <p className="text-sm text-graphite-600">
              Resultado cero: el fichero no requiere forma de pago.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-sand-200 px-4 py-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-[#1a4480] hover:bg-[#153a6b]"
            disabled={toPay && payment === "domiciliacion" && (!directDebitOpen || !hasIban)}
            onClick={() => void confirm()}
          >
            Descargar fichero .303
          </Button>
        </div>
      </div>
    </div>
  )
}

function PaymentDescription({
  payment,
  directDebitOpen,
  directDebitDeadline,
  hasIban,
  ibanDisplay,
  bank,
}: {
  payment: Model303ExportPayment
  directDebitOpen: boolean
  directDebitDeadline: string | null
  hasIban: boolean
  ibanDisplay: string
  bank?: string | null
}) {
  if (payment === "solicitud_nrc") {
    return (
      <>
        El fichero se descarga a ingresar. En la Sede, después de importarlo, pulsa «Realizar pago (NRC)»
        para el cargo en cuenta, la tarjeta o Bizum. Hacienda entrega el NRC antes de firmar.
      </>
    )
  }
  if (payment === "nrc_obtenido") {
    return (
      <>
        El cliente ya ha pagado. Indica el NRC de 22 caracteres. El fichero se descarga a ingresar y, al
        firmar en la Sede, elige «Recuperar un pago previo (NRC)».
      </>
    )
  }
  if (payment === "domiciliacion") {
    if (!directDebitOpen) {
      return (
        <>
          El plazo de domiciliación de este periodo terminó
          {directDebitDeadline ? ` el ${directDebitDeadline}` : ""}. Usa solicitud de NRC.
        </>
      )
    }
    return (
      <>
        El fichero incluye el IBAN para que Hacienda cargue el importe
        {hasIban ? `: ${bank ? `${bank}, ` : ""}${ibanDisplay}` : ""}. La presentación con este método
        debe hacerse, como norma general, antes del día 15 del mes siguiente al periodo.
      </>
    )
  }
  if (payment === "entidad_colaboradora") {
    return (
      <>
        El fichero se descarga a ingresar para pagarlo en una entidad colaboradora. El banco entrega el
        NRC y se anota en la Sede al firmar.
      </>
    )
  }
  return (
    <>
      El fichero se descarga a ingresar. El aplazamiento del pago se solicita en la Sede al presentar
      la autoliquidación.
    </>
  )
}

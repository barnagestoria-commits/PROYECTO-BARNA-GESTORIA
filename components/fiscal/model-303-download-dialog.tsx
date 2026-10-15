"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  defaultModel303ExportPayment,
  type Model303ExportPayment,
} from "@/lib/fiscal/model-303/export-payment"
import { formatIbanDisplay } from "@/lib/banking/iban"
import { cn } from "@/lib/utils"

interface Model303DownloadDialogProps {
  open: boolean
  resultAmount: number
  taxDirectDebitIban?: string | null
  taxDirectDebitBank?: string | null
  onConfirm: (payment: Model303ExportPayment) => void
  onCancel: () => void
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amount)
}

export function Model303DownloadDialog({
  open,
  resultAmount,
  taxDirectDebitIban,
  taxDirectDebitBank,
  onConfirm,
  onCancel,
}: Model303DownloadDialogProps) {
  const [payment, setPayment] = useState<Model303ExportPayment>(() =>
    defaultModel303ExportPayment(resultAmount),
  )

  useEffect(() => {
    if (open) setPayment(defaultModel303ExportPayment(resultAmount))
  }, [open, resultAmount])

  if (!open) return null

  const toPay = resultAmount > 0.005
  const toCompensate = resultAmount < -0.005
  const ibanDisplay = formatIbanDisplay(taxDirectDebitIban)
  const hasIban = Boolean((taxDirectDebitIban ?? "").replace(/\s/g, ""))

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="model303-download-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-black bg-white shadow-xl"
      >
        <div className="border-b border-black bg-[#1a4480] px-4 py-3 text-white">
          <h2 id="model303-download-title" className="text-sm font-bold">
            Forma de pago en el fichero 303
          </h2>
          <p className="mt-1 text-xs text-white/85">
            Hacienda usa esta opción al importar el DR303. Resultado del periodo:{" "}
            <span className="font-semibold">{formatEuro(resultAmount)}</span>
          </p>
        </div>

        <div className="space-y-3 p-4">
          {toPay ? (
            <>
              <PaymentOption
                checked={payment === "ingreso"}
                onSelect={() => setPayment("ingreso")}
                title="Ingreso (entidad colaboradora)"
                description="Pagarás el importe por la vía habitual (banco, Bizum, etc.) sin domiciliar en el fichero."
              />
              <PaymentOption
                checked={payment === "domiciliacion"}
                onSelect={() => setPayment("domiciliacion")}
                title="Domiciliación en cuenta (cargo en cuenta)"
                description={
                  hasIban
                    ? `Se incluirá el IBAN de impuestos${taxDirectDebitBank ? ` (${taxDirectDebitBank})` : ""}: ${ibanDisplay}.`
                    : "Necesitas indicar la cuenta de domiciliación de impuestos en tu perfil."
                }
              />
              {payment === "domiciliacion" && !hasIban ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <Link href="/configuracion" className="font-medium underline">
                    Ir a Configuración → Perfil
                  </Link>{" "}
                  y completa «Cuenta para domiciliar impuestos».
                </p>
              ) : null}
            </>
          ) : null}

          {toCompensate ? (
            <PaymentOption
              checked={payment === "compensacion"}
              onSelect={() => setPayment("compensacion")}
              title="Compensar en posteriores autoliquidaciones"
              description="Opción habitual cuando el resultado es negativo (casilla 110 / tipo C)."
            />
          ) : null}

          {!toPay && !toCompensate ? (
            <p className="text-sm text-graphite-600">
              Resultado cero: el fichero no requiere forma de ingreso especial.
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
            disabled={toPay && payment === "domiciliacion" && !hasIban}
            onClick={() => onConfirm(payment)}
          >
            Descargar fichero .303
          </Button>
        </div>
      </div>
    </div>
  )
}

function PaymentOption({
  checked,
  onSelect,
  title,
  description,
}: {
  checked: boolean
  onSelect: () => void
  title: string
  description: string
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
        checked ? "border-[#1a4480] bg-blue-50/50" : "border-sand-200 hover:bg-sand-50",
      )}
    >
      <input
        type="radio"
        className="mt-1"
        checked={checked}
        onChange={onSelect}
        name="model303-payment"
      />
      <span>
        <span className="block text-sm font-medium text-pine-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-graphite-600">{description}</span>
      </span>
    </label>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, Clock, Copy, FileUp, Loader2, ShieldCheck } from "lucide-react"
import { useRequireAuth } from "@/components/auth-provider"
import { apiFetch, apiFormFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"

type PagoEstado = "pendiente" | "aprobado" | "rechazado"

interface CheckoutData {
  bank: {
    ibanDisplay: string
    beneficiary: string
    bankName: string | null
    instructions: string | null
  }
  reference: string
  isActive: boolean
  payments: { id: string; estado: PagoEstado; fecha: string; fileName: string }[]
}

const MAX_BYTES = 4 * 1024 * 1024
const ESTADO_LABEL: Record<PagoEstado, string> = {
  pendiente: "En revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
}

/** Las fotos del móvil pesan 5-10 MB. Se reducen aquí para que quepan en el límite de subida. */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext("2d")
    if (!context) return file
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85))
    if (!blob || (blob.size >= file.size && file.size <= MAX_BYTES)) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" })
  } catch {
    return file
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1800)
        } catch {
          /* sin permiso de portapapeles: el valor sigue visible para copiarlo a mano */
        }
      }}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-sand-300 bg-white px-3 text-sm font-medium text-pine-900 hover:bg-sand-50"
      aria-label={`Copiar ${label}`}
    >
      {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  )
}

function DetailRow({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="flex flex-col gap-1 border-b border-sand-200 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-graphite-500">{label}</p>
        <p className="break-all font-mono text-base font-semibold text-pine-950 sm:text-lg">{value}</p>
      </div>
      {copy ? <CopyButton value={value.replace(/\s/g, "")} label={label} /> : null}
    </div>
  )
}

export function BankTransferCheckout() {
  const { session, isLoading } = useRequireAuth()
  const [data, setData] = useState<CheckoutData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedNotice, setUploadedNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<CheckoutData>("/api/checkout/transferencia"))
      setLoadError(null)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "No se han podido cargar los datos de pago.")
    }
  }, [])

  useEffect(() => {
    if (!isLoading && session) void load()
  }, [isLoading, session, load])

  async function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0]
    event.target.value = ""
    if (!chosen) return

    setUploadError(null)
    setUploadedNotice(null)
    setUploading(true)
    try {
      const file = await shrinkImage(chosen)
      if (file.size > MAX_BYTES) {
        throw new Error("El archivo pesa más de 4 MB. Sube una foto más pequeña o el PDF del banco.")
      }
      const formData = new FormData()
      formData.append("file", file)
      const result = await apiFormFetch<{ duplicate: boolean }>("/api/checkout/transferencia", formData)
      setUploadedNotice(
        result.duplicate
          ? "Este justificante ya estaba enviado. Lo estamos revisando."
          : "Justificante recibido. Lo revisaremos y activaremos tu cuenta en cuanto confirmemos el pago.",
      )
      await load()
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : "No se ha podido subir el justificante.")
    } finally {
      setUploading(false)
    }
  }

  if (isLoading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    )
  }

  const hasPending = data?.payments.some((payment) => payment.estado === "pendiente") ?? false

  return (
    <main className="min-h-screen bg-sand-50 px-4 py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Taxlyn</p>
          <h1 className="mt-1 text-2xl font-bold text-pine-950 sm:text-3xl">Pago por transferencia</h1>
          <p className="mt-2 text-graphite-600">
            Haz la transferencia con los datos de abajo y sube aquí el justificante. Revisamos cada pago a mano y activamos tu
            cuenta en cuanto lo confirmamos.
          </p>
        </header>

        {loadError ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </p>
        ) : null}

        {data?.isActive ? (
          <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Tu cuenta ya está activa. Puedes seguir usando Taxlyn con normalidad.
          </p>
        ) : null}

        {!data && !loadError ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
          </div>
        ) : null}

        {data ? (
          <>
            <section className="rounded-2xl border border-sand-200 bg-white p-5" aria-labelledby="datos-bancarios">
              <h2 id="datos-bancarios" className="text-lg font-semibold text-pine-950">
                1. Datos bancarios
              </h2>
              <div className="mt-2">
                <DetailRow label="IBAN" value={data.bank.ibanDisplay} copy />
                <DetailRow label="Beneficiario" value={data.bank.beneficiary} />
                {data.bank.bankName ? <DetailRow label="Banco" value={data.bank.bankName} /> : null}
              </div>

              <div className="mt-4 rounded-xl border border-gold-300 bg-gold-50 p-4">
                <p className="text-sm text-pine-950">Por favor, en la transferencia coloca este concepto.</p>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="break-all font-mono text-base font-semibold text-pine-950">
                    Referencia: {data.reference}
                  </p>
                  <CopyButton value={data.reference} label="la referencia" />
                </div>
                <p className="mt-2 text-xs text-graphite-600">
                  Sin esta referencia no podemos saber de quién es el pago y tardaremos más en activar tu cuenta.
                </p>
              </div>

              {data.bank.instructions ? (
                <p className="mt-4 whitespace-pre-line text-sm text-graphite-700">{data.bank.instructions}</p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-sand-200 bg-white p-5" aria-labelledby="subir-justificante">
              <h2 id="subir-justificante" className="text-lg font-semibold text-pine-950">
                2. Sube el justificante
              </h2>
              <p className="mt-1 text-sm text-graphite-600">Foto o PDF del recibo del banco. Máximo 4 MB. Se envía al elegirlo.</p>

              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={onFileChosen}
                disabled={uploading}
                className="sr-only"
                id="comprobante"
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className={cn(
                  "mt-4 flex min-h-[7rem] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
                  "border-emerald-700/40 bg-emerald-50/40 text-emerald-900 hover:bg-emerald-50 disabled:opacity-60",
                )}
              >
                {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
                <span className="font-semibold">{uploading ? "Subiendo justificante…" : "Elegir foto o PDF del recibo"}</span>
              </button>

              {uploadError ? (
                <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {uploadError}
                </p>
              ) : null}
              {uploadedNotice ? (
                <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  {uploadedNotice}
                </p>
              ) : null}
            </section>

            {data.payments.length > 0 ? (
              <section className="rounded-2xl border border-sand-200 bg-white p-5" aria-labelledby="mis-justificantes">
                <h2 id="mis-justificantes" className="text-lg font-semibold text-pine-950">
                  Tus justificantes
                </h2>
                {hasPending ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-graphite-600">
                    <Clock className="h-4 w-4" /> Revisamos los pagos a mano, normalmente en un día laborable.
                  </p>
                ) : null}
                <ul className="mt-3 divide-y divide-sand-200">
                  {data.payments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-pine-950">{payment.fileName}</p>
                        <p className="text-xs text-graphite-500">{new Date(payment.fecha).toLocaleString("es-ES")}</p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                          payment.estado === "aprobado" && "bg-emerald-100 text-emerald-900",
                          payment.estado === "pendiente" && "bg-amber-100 text-amber-900",
                          payment.estado === "rechazado" && "bg-red-100 text-red-800",
                        )}
                      >
                        {ESTADO_LABEL[payment.estado]}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  )
}

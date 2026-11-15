"use client"

import Link from "next/link"
import { Clock, Download, Lock } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { canCloseOwnAccount } from "@/lib/auth/account-closure"
import { cn } from "@/lib/utils"

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** Aviso de la prueba gratuita (cuenta atrás) y del modo solo lectura posterior. */
export function AccountAccessBanner() {
  const { session } = useAuth()
  const access = session?.user.access
  if (!session || !access || session.user.isPlatformOperator) return null
  if (access.phase === "active") return null

  const readonly = access.phase !== "trial"
  const canDownload = canCloseOwnAccount(session.user.role)
  const pendingPlan = Boolean(session.user.accountRequestedPlan)

  return (
    <div
      role="status"
      className={cn(
        "border-b",
        readonly ? "border-red-300 bg-red-50 text-red-950" : "border-emerald-300 bg-emerald-50 text-emerald-950",
      )}
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="flex min-w-0 items-start gap-2">
          {readonly ? <Lock className="mt-0.5 h-4 w-4 shrink-0" /> : <Clock className="mt-0.5 h-4 w-4 shrink-0" />}
          {readonly ? (
            <p className="text-sm">
              <span className="font-semibold">Tu prueba gratuita ha terminado: la cuenta está en solo lectura.</span>{" "}
              Si no contratas un plan, se eliminará el {formatDate(access.deletionAt)} (
              {plural(access.daysUntilDeletion ?? 0, "día", "días")}) y no podrá recuperarse.
              {canDownload ? " Descarga tus datos antes de esa fecha." : ""}
            </p>
          ) : (
            <p className="text-sm">
              <span className="font-semibold">Prueba gratuita: te quedan {plural(access.daysLeft ?? 0, "día", "días")}</span>{" "}
              (hasta el {formatDate(access.trialEndsAt)}). Después tendrás 15 días en solo lectura para descargar tus datos.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {readonly && canDownload ? (
            <a
              href="/api/account/export"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-900 bg-white px-4 text-sm font-semibold text-red-950 hover:bg-red-100"
            >
              <Download className="h-4 w-4" />
              Descargar mis datos
            </a>
          ) : null}
          <Link
            href="/checkout/transferencia"
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white",
              readonly ? "bg-red-900 hover:bg-red-950" : "bg-emerald-800 hover:bg-emerald-900",
            )}
          >
            {pendingPlan ? "Subir justificante" : "Contratar un plan"}
          </Link>
        </div>
      </div>
    </div>
  )
}

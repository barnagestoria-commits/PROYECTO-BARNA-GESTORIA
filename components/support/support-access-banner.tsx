"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LifeBuoy, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api-client"

export function SupportAccessBanner() {
  const { session, refreshSession } = useAuth()
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const access = session?.supportAccess

  if (!access) return null

  async function leave() {
    setLeaving(true)
    setError(null)
    try {
      await apiFetch("/api/support/leave", { method: "POST" })
      await refreshSession()
      router.push("/dashboard/soporte")
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido salir de la cuenta.")
      setLeaving(false)
    }
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-950">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="flex min-w-0 items-start gap-2">
          <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-sm">
            Estás dentro de <span className="font-semibold">{access.companyName}</span>
            {access.ownerEmail ? ` (${access.ownerEmail})` : ""}. Los cambios y las presentaciones se hacen en esta empresa.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
          <button
            type="button"
            onClick={() => void leave()}
            disabled={leaving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-amber-900 px-4 text-sm font-semibold text-white hover:bg-amber-950 disabled:opacity-60"
          >
            {leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salir de esta cuenta
          </button>
          {error ? <p className="text-xs text-red-700">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}

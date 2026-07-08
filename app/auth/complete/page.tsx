"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { apiFetch, type SessionResponse } from "@/lib/api-client"
import { useAuth } from "@/components/auth-provider"

export default function OAuthCompletePage() {
  const router = useRouter()
  const { refreshSession } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function complete() {
      try {
        const data = await apiFetch<SessionResponse>("/api/auth/oauth/complete", { method: "POST" })
        if (cancelled) return
        await refreshSession()
        if (data.session) {
          router.replace("/dashboard")
        } else {
          setError("No se pudo crear la sesión de la plataforma.")
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Error al completar el acceso social.")
      }
    }

    complete()

    return () => {
      cancelled = true
    }
  }, [router, refreshSession])

  return (
    <div className="min-h-screen elegant-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-sand-300 bg-white p-8 text-center shadow-xl">
        <div className="mb-4 flex items-center justify-center gap-2">
          <ResponsiveLogo size="md" />
          <span className="text-xl font-bold text-pine-900">Barna Gestoría</span>
        </div>

        {error ? (
          <div className="space-y-4">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="text-sm text-emerald-700 hover:underline"
            >
              Volver al inicio de sesión
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-emerald-800">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Completando acceso con tu cuenta…</p>
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, PauseCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/components/auth-provider"
import { canCloseOwnAccount } from "@/lib/auth/account-closure"
import { apiFetch, type SessionResponse } from "@/lib/api-client"

function formatPausedDate(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
}

export function AccountClosureCard() {
  const { session, refreshSession } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<"pause" | "delete" | null>(null)
  const [confirmText, setConfirmText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!session) return null

  const canClose = canCloseOwnAccount(session.user.role)
  const paused = session.user.accountBillingStatus === "PAUSED"
  const pausedOn = formatPausedDate(session.user.accountBillingPausedAt)

  const pause = async () => {
    setBusy(true)
    setError(null)
    try {
      const data = await apiFetch<SessionResponse>("/api/auth/account-closure", {
        method: "POST",
        body: JSON.stringify({ mode: "pause" }),
      })
      if (data.session) {
        await refreshSession()
      }
      setMode(null)
      setNotice("Suscripción en pausa. No se cobra y los datos siguen en el programa.")
    } catch (pauseError) {
      setError(pauseError instanceof Error ? pauseError.message : "No se pudo pausar la suscripción.")
    } finally {
      setBusy(false)
    }
  }

  const resume = async () => {
    setBusy(true)
    setError(null)
    try {
      await apiFetch<SessionResponse>("/api/auth/account-closure", {
        method: "POST",
        body: JSON.stringify({ mode: "resume" }),
      })
      await refreshSession()
      setNotice("Suscripción reactivada.")
    } catch (resumeError) {
      setError(resumeError instanceof Error ? resumeError.message : "No se pudo reactivar la suscripción.")
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (confirmText.trim().toUpperCase() !== "ELIMINAR") {
      setError("Escribe ELIMINAR para confirmar el borrado.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiFetch("/api/auth/account-closure", {
        method: "POST",
        body: JSON.stringify({ mode: "delete" }),
      })
      router.push("/login")
      router.refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la cuenta.")
      setBusy(false)
    }
  }

  return (
    <Card className="border-sand-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg text-pine-900">Baja de la cuenta</CardTitle>
        <CardDescription>
          Si quieres dejar de usar Taxlyn, puedes pausar la suscripción y conservar los datos, o
          eliminar la cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        {paused ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            La suscripción está en pausa{pausedOn ? ` desde el ${pausedOn}` : ""}. No se cobra
            mientras siga así. Empresas, asientos y facturas siguen guardados.
            {canClose ? (
              <div className="mt-3">
                <Button type="button" size="sm" onClick={resume} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Reactivar suscripción
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {!canClose ? (
          <p className="text-sm text-graphite-600">
            La baja de la suscripción la gestiona quien administra la cuenta.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setMode("pause")
                setConfirmText("")
                setError(null)
              }}
              className="rounded-xl border border-sand-200 bg-white p-4 text-left hover:border-emerald-200 hover:bg-emerald-50/40"
            >
              <PauseCircle className="mb-2 h-5 w-5 text-emerald-700" />
              <span className="block font-medium text-pine-900">Baja temporal</span>
              <span className="mt-1 block text-sm text-graphite-500">
                No se cobra la suscripción. Los datos se quedan para cuando vuelvas.
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("delete")
                setConfirmText("")
                setError(null)
              }}
              className="rounded-xl border border-red-200 bg-white p-4 text-left hover:bg-red-50/60"
            >
              <Trash2 className="mb-2 h-5 w-5 text-red-700" />
              <span className="block font-medium text-pine-900">Eliminar la cuenta</span>
              <span className="mt-1 block text-sm text-graphite-500">
                Se borra el acceso y los datos de esta cuenta. No se puede deshacer.
              </span>
            </button>
          </div>
        )}

        {canClose && mode === "pause" && !paused ? (
          <div className="rounded-xl border border-sand-200 bg-sand-50 p-4">
            <p className="text-sm text-pine-900">
              ¿Pausar la suscripción? Mientras esté en pausa no se cobra. Empresas, asientos y
              facturas no se borran, y puedes reactivarla desde aquí.
            </p>
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" onClick={pause} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Pausar suscripción
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setMode(null)} disabled={busy}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}

        {canClose && mode === "delete" ? (
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
            <p className="text-sm text-pine-900">
              {session.user.accountType === "GESTORIA"
                ? "Se eliminará esta cuenta, con sus empresas, asientos y usuarios del despacho. Escribe ELIMINAR para confirmar."
                : "Se eliminará esta cuenta, con sus empresas, asientos y facturas. Escribe ELIMINAR para confirmar."}
            </p>
            <Input
              className="mt-3 max-w-xs bg-white"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              aria-label="Escribe ELIMINAR para confirmar"
              autoComplete="off"
            />
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" variant="destructive" onClick={remove} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Eliminar la cuenta
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setMode(null)} disabled={busy}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

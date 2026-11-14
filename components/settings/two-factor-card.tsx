"use client"

import { useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/password-input"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "@/components/auth-provider"

export function TwoFactorCard() {
  const { session, refreshSession } = useAuth()
  const enabled = Boolean(session?.user.emailTwoFactorEnabled)
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [waitingCode, setWaitingCode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function sendCode() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await apiFetch("/api/auth/two-factor", { method: "POST", body: JSON.stringify({ action: "send" }) })
      setWaitingCode(true)
      setMessage("Te hemos enviado un código. Escríbelo para activar la verificación.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido enviar el código.")
    } finally {
      setBusy(false)
    }
  }

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      await apiFetch("/api/auth/two-factor", {
        method: "POST",
        body: JSON.stringify({ action: "enable", code }),
      })
      setWaitingCode(false)
      setCode("")
      setMessage("La verificación por correo queda activada.")
      await refreshSession()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido activar.")
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await apiFetch("/api/auth/two-factor", {
        method: "POST",
        body: JSON.stringify({ action: "disable", password }),
      })
      setPassword("")
      setMessage("La verificación por correo queda desactivada.")
      await refreshSession()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido desactivar.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-sand-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
          <div>
            <CardTitle className="text-lg text-pine-900">Verificación en dos pasos</CardTitle>
            <CardDescription>
              {enabled
                ? "Al entrar te pedimos un código en el correo, salvo en un dispositivo que hayas recordado."
                : "Puedes pedir un código al correo cada vez que entres desde un equipo nuevo."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {enabled ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <PasswordInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Tu contraseña"
            />
            <Button type="button" variant="outline" onClick={() => void disable()} disabled={busy || !password}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desactivar"}
            </Button>
          </div>
        ) : waitingCode ? (
          <div className="space-y-2">
            <Label htmlFor="two-factor-code">Código del correo</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="two-factor-code"
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <Button type="button" onClick={() => void enable()} disabled={busy || code.trim().length < 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activar"}
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" onClick={() => void sendCode()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Activar verificación por correo
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

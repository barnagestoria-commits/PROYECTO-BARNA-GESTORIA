"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/password-input"
import { SocialLoginButtons } from "@/components/social-login-buttons"
import { LegalFooterLinks } from "@/components/legal-footer-links"
import { TRUSTED_DEVICE_ACCEPTANCE } from "@/lib/auth/trusted-device-terms"
import { Mail, Lock } from "lucide-react"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { useAuth } from "@/components/auth-provider"

const SHOW_DEMO_CREDENTIALS = process.env.NODE_ENV !== "production"

export default function LoginPage() {
  const { login, confirmLoginCode } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [rememberDevice, setRememberDevice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const result = await login(email, password)
      if (result.twoFactorRequired) {
        setChallengeId(result.challengeId)
        setIsLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión.")
      setIsLoading(false)
    }
  }

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!challengeId) return
    setError(null)
    setIsLoading(true)
    try {
      await confirmLoginCode(challengeId, code, rememberDevice)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido comprobar el código.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen elegant-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-sand-300">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-4">
            <ResponsiveLogo size="md" />
            <span className="text-xl md:text-2xl font-bold text-pine-900">Taxlyn</span>
          </div>
          <CardTitle className="text-pine-900">Iniciar Sesión</CardTitle>
          <CardDescription className="text-graphite-600">
            Accede a tu programa de gestión
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {challengeId ? (
          <form onSubmit={handleCode} className="space-y-4">
            <p className="text-sm text-graphite-600">
              Te hemos enviado un código a tu correo. Escríbelo para entrar.
            </p>
            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-pine-900">
              <input
                type="checkbox"
                className="mt-1"
                checked={rememberDevice}
                onChange={(event) => setRememberDevice(event.target.checked)}
              />
              Recordar este dispositivo
            </label>
            {rememberDevice ? (
              <p className="rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-xs leading-relaxed text-graphite-700">
                {TRUSTED_DEVICE_ACCEPTANCE}{" "}
                <Link href="/terminos-servicio#dispositivos-de-confianza" className="text-emerald-800 underline">
                  Ver los términos
                </Link>
                .
              </p>
            ) : null}
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full bg-emerald-800 hover:bg-pine-900" disabled={isLoading}>
              {isLoading ? "Comprobando..." : "Confirmar código"}
            </Button>
          </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-emerald-600" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-3 z-10 h-4 w-4 text-emerald-600" aria-hidden="true" />
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full bg-emerald-800 hover:bg-pine-900" disabled={isLoading}>
              {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
          </form>
          )}

          <SocialLoginButtons />

          <div className="text-center text-sm">
            <span className="text-graphite-600">¿No tienes cuenta? </span>
            <Link href="/register" className="text-emerald-700 hover:underline">
              Regístrate
            </Link>
          </div>

          {SHOW_DEMO_CREDENTIALS && (
          <div className="space-y-2 rounded-lg border border-sand-300 bg-sand-100 p-3 text-sm text-pine-800">
            <p>
              <strong>Despacho:</strong> admin@gestoria.com / demo123
            </p>
            <p>
              <strong>Gestor:</strong> gestor@gestoria.com / demo123
            </p>
            <p>
              <strong>Cliente final:</strong> juan@empresa.com / demo123
            </p>
          </div>
          )}

          <LegalFooterLinks />
        </CardContent>
      </Card>
    </div>
  )
}

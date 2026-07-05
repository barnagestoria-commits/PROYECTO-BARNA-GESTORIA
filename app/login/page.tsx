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
import { Mail, Lock } from "lucide-react"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { useAuth } from "@/components/auth-provider"

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen elegant-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-sand-300">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-4">
            <ResponsiveLogo size="md" />
            <span className="text-xl md:text-2xl font-bold text-pine-900">Barna Gestoría</span>
          </div>
          <CardTitle className="text-pine-900">Iniciar Sesión</CardTitle>
          <CardDescription className="text-graphite-600">
            Accede a tu panel de documentos fiscales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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

          <SocialLoginButtons />

          <div className="text-center text-sm">
            <span className="text-graphite-600">¿No tienes cuenta? </span>
            <Link href="/register" className="text-emerald-700 hover:underline">
              Regístrate
            </Link>
          </div>

          <div className="space-y-2 rounded-lg border border-sand-300 bg-sand-100 p-3 text-sm text-pine-800">
            <p>
              <strong>Gestoría:</strong> admin@gestoria.com / demo123
            </p>
            <p>
              <strong>Gestor:</strong> gestor@gestoria.com / demo123
            </p>
            <p>
              <strong>Cliente final:</strong> juan@empresa.com / demo123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

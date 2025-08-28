"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Lock } from "lucide-react"
import { ResponsiveLogo } from "@/components/responsive-logo"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulación de login - aquí integrarías con Supabase
    setTimeout(() => {
      setIsLoading(false)
      if (email === "admin@gestoria.com") {
        router.push("/admin")
      } else {
        router.push("/dashboard")
      }
    }, 1000)
  }

  return (
    <div className="min-h-screen elegant-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-sand-300">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-4">
            <ResponsiveLogo size="md" />
            <span className="text-xl md:text-2xl font-bold text-pine-900">
              <span className="hidden sm:inline">Barna Gestoría</span>
              <span className="sm:hidden">Barna</span>
            </span>
          </div>
          <CardTitle className="text-pine-900">Iniciar Sesión</CardTitle>
          <CardDescription className="text-graphite-600">Accede a tu panel de documentos fiscales</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-graphite-800">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 border-sand-300 focus:border-emerald-600 focus:ring-emerald-600"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-graphite-800">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 border-sand-300 focus:border-emerald-600 focus:ring-emerald-600"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-emerald-800 hover:bg-pine-900 transition-all shadow-lg"
              disabled={isLoading}
            >
              {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-graphite-600">¿No tienes cuenta? </span>
            <Link href="/register" className="text-emerald-700 hover:text-pine-800 hover:underline transition-colors">
              Regístrate aquí
            </Link>
          </div>

          <div className="mt-4 p-3 bg-sand-100 rounded-lg text-sm text-pine-800 border border-sand-300">
            <strong>Demo:</strong> Usa admin@gestoria.com para panel admin, o cualquier otro email para cliente
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

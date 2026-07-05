"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building, Building2, Mail, Lock, User, Phone, Briefcase } from "lucide-react"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { useAuth, type AccountType } from "@/components/auth-provider"

export default function RegisterPage() {
  const { register } = useAuth()
  const [accountType, setAccountType] = useState<AccountType>("CLIENTE_FINAL")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    cif: "",
    password: "",
    confirmPassword: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setIsLoading(true)

    try {
      await register({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        password: formData.password,
        accountType,
        companyName: formData.companyName,
        cif: accountType === "CLIENTE_FINAL" ? formData.cif || undefined : undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta.")
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  return (
    <div className="min-h-screen elegant-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl border-sand-300">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-4">
            <ResponsiveLogo size="md" />
            <span className="text-xl md:text-2xl font-bold text-pine-900">Barna Gestoría</span>
          </div>
          <CardTitle className="text-pine-900">Crear Cuenta</CardTitle>
          <CardDescription className="text-graphite-600">
            Elige el tipo de cuenta y configura tu espacio de trabajo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-graphite-800">Tipo de cuenta</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAccountType("CLIENTE_FINAL")}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    accountType === "CLIENTE_FINAL"
                      ? "border-emerald-600 bg-emerald-50"
                      : "border-sand-300 hover:border-gray-400"
                  }`}
                >
                  <Building className="mb-2 h-5 w-5 text-emerald-700" />
                  <p className="font-medium text-sm">Cliente final</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Autónomo, empresa o persona física con su propio espacio.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType("GESTORIA")}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    accountType === "GESTORIA"
                      ? "border-emerald-600 bg-emerald-50"
                      : "border-sand-300 hover:border-gray-400"
                  }`}
                >
                  <Briefcase className="mb-2 h-5 w-5 text-emerald-700" />
                  <p className="font-medium text-sm">Gestoría</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Despacho profesional que gestiona múltiples clientes.
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">
                {accountType === "GESTORIA" ? "Nombre del despacho" : "Nombre de la empresa / autónomo"}
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                <Input
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {accountType === "CLIENTE_FINAL" && (
              <div className="space-y-2">
                <Label htmlFor="cif">NIF / CIF (opcional)</Label>
                <Input id="cif" name="cif" value={formData.cif} onChange={handleChange} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full bg-emerald-800 hover:bg-pine-900" disabled={isLoading}>
              {isLoading ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-graphite-600">¿Ya tienes cuenta? </span>
            <Link href="/login" className="text-emerald-700 hover:underline">
              Inicia sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

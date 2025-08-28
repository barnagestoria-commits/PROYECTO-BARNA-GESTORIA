"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building, Mail, Lock, User, Phone } from "lucide-react"
import { ResponsiveLogo } from "@/components/responsive-logo"

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    password: "",
    confirmPassword: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulación de registro - aquí integrarías con Supabase
    setTimeout(() => {
      setIsLoading(false)
      router.push("/dashboard")
    }, 1000)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
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
          <CardTitle className="text-pine-900">Crear Cuenta</CardTitle>
          <CardDescription className="text-graphite-600">
            Regístrate para comenzar a subir tus documentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-graphite-800">
                Nombre Completo
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                <Input
                  id="name"
                  name="name"
                  placeholder="Juan Pérez"
                  value={formData.name}
                  onChange={handleChange}
                  className="pl-10 border-sand-300 focus:border-emerald-600 focus:ring-emerald-600"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-graphite-800">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="juan@empresa.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10 border-sand-300 focus:border-emerald-600 focus:ring-emerald-600"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-graphite-800">
                Teléfono
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                <Input
                  id="phone"
                  name="phone"
                  placeholder="+34 600 000 000"
                  value={formData.phone}
                  onChange={handleChange}
                  className="pl-10 border-sand-300 focus:border-emerald-600 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company" className="text-graphite-800">
                Empresa
              </Label>
              <div className="relative">
                <Building className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                <Input
                  id="company"
                  name="company"
                  placeholder="Mi Empresa SL"
                  value={formData.company}
                  onChange={handleChange}
                  className="pl-10 border-sand-300 focus:border-emerald-600 focus:ring-emerald-600"
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
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 border-sand-300 focus:border-emerald-600 focus:ring-emerald-600"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-graphite-800">
                Confirmar Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
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
              {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-graphite-600">¿Ya tienes cuenta? </span>
            <Link href="/login" className="text-emerald-700 hover:text-pine-800 hover:underline transition-colors">
              Inicia sesión aquí
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import type React from "react"
import { useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building, Building2, Mail, Lock, User, Phone, Briefcase, Factory } from "lucide-react"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { SocialLoginButtons } from "@/components/social-login-buttons"
import { LegalFooterLinks } from "@/components/legal-footer-links"
import { useAuth, type AccountType } from "@/components/auth-provider"
import { suggestEmpresaTier } from "@/lib/settings/empresa-tier-evaluator"
import {
  AUTONOMO_PLAN,
  EMPRESA_FIRST_YEAR_EVALUATION_NOTE,
} from "@/lib/settings/subscription-plans"
import {
  saveEmpresaSubscriptionStartedAt,
  saveStoredEmpresaSizing,
  saveStoredEmpresaTierId,
} from "@/lib/settings/subscription-storage"

const ACCOUNT_TYPE_OPTIONS: {
  value: AccountType
  title: string
  description: string
  price: string
  icon: typeof Building
}[] = [
  {
    value: "CLIENTE_FINAL",
    title: "Autónomo",
    description: AUTONOMO_PLAN.description,
    price: `${AUTONOMO_PLAN.priceLabel}/mes`,
    icon: Building,
  },
  {
    value: "EMPRESA",
    title: "Empresa",
    description: "Sociedad con cuenta propia. Cuota según facturación y movimientos bancarios.",
    price: "Desde 450 €/mes",
    icon: Factory,
  },
  {
    value: "GESTORIA",
    title: "Gestoría",
    description: "Despacho profesional que gestiona múltiples clientes.",
    price: "Desde 1.000 €/mes",
    icon: Briefcase,
  },
]

function getCompanyNameLabel(accountType: AccountType): string {
  switch (accountType) {
    case "GESTORIA":
      return "Nombre del despacho"
    case "EMPRESA":
      return "Nombre de la empresa"
    default:
      return "Nombre del autónomo / actividad"
  }
}

export default function RegisterPage() {
  const { register } = useAuth()
  const [accountType, setAccountType] = useState<AccountType>("CLIENTE_FINAL")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    cif: "",
    annualRevenue: "250000",
    monthlyMovements: "80",
    password: "",
    confirmPassword: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const suggestedEmpresaTier = useMemo(() => {
    const revenue = Number(formData.annualRevenue) || 0
    const movements = Number(formData.monthlyMovements) || 0
    return suggestEmpresaTier({
      annualRevenueEuros: revenue,
      monthlyBankMovements: movements,
    })
  }, [formData.annualRevenue, formData.monthlyMovements])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }

    if (accountType === "EMPRESA") {
      const revenue = Number(formData.annualRevenue)
      const movements = Number(formData.monthlyMovements)
      if (!revenue || revenue <= 0) {
        setError("Indica la facturación anual estimada de la empresa.")
        return
      }
      if (!movements || movements <= 0) {
        setError("Indica los movimientos bancarios mensuales estimados.")
        return
      }
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
        cif: accountType !== "GESTORIA" ? formData.cif || undefined : undefined,
      })

      if (accountType === "EMPRESA") {
        const revenue = Number(formData.annualRevenue)
        const movements = Number(formData.monthlyMovements)
        saveStoredEmpresaSizing({
          annualRevenueEuros: revenue,
          monthlyBankMovements: movements,
        })
        saveStoredEmpresaTierId(suggestedEmpresaTier.id)
        saveEmpresaSubscriptionStartedAt(new Date().toISOString())
      }
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
      <Card className="w-full max-w-3xl shadow-xl border-sand-300">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-4">
            <ResponsiveLogo size="md" />
            <span className="text-xl md:text-2xl font-bold text-pine-900">Barna Gestoría</span>
          </div>
          <CardTitle className="text-pine-900">Crear Cuenta</CardTitle>
          <CardDescription className="text-graphite-600">
            Elige tu tipo de usuario: Autónomo, Empresa o Gestoría
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SocialLoginButtons mode="register" />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-graphite-800">Tipo de cuenta</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {ACCOUNT_TYPE_OPTIONS.map((option) => {
                  const Icon = option.icon
                  const selected = accountType === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAccountType(option.value)}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        selected
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-sand-300 hover:border-gray-400"
                      }`}
                    >
                      <Icon className="mb-2 h-5 w-5 text-emerald-700" />
                      <p className="font-medium text-sm">{option.title}</p>
                      <p className="mt-1 text-xs font-medium text-emerald-800">{option.price}</p>
                      <p className="mt-1 text-xs text-gray-500">{option.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {accountType === "EMPRESA" && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <p className="text-sm font-medium text-amber-900">Dimensionamiento inicial (año 1)</p>
                <p className="text-xs text-amber-800">{EMPRESA_FIRST_YEAR_EVALUATION_NOTE}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="annualRevenue">Facturación anual estimada (€)</Label>
                    <Input
                      id="annualRevenue"
                      name="annualRevenue"
                      type="number"
                      min={1}
                      value={formData.annualRevenue}
                      onChange={handleChange}
                      required={accountType === "EMPRESA"}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="monthlyMovements">Movimientos bancarios / mes (estimados)</Label>
                    <Input
                      id="monthlyMovements"
                      name="monthlyMovements"
                      type="number"
                      min={1}
                      value={formData.monthlyMovements}
                      onChange={handleChange}
                      required={accountType === "EMPRESA"}
                    />
                  </div>
                </div>
                <p className="text-sm text-pine-900">
                  Tramo sugerido:{" "}
                  <strong>
                    {suggestedEmpresaTier.name} · {suggestedEmpresaTier.priceLabel}
                    {suggestedEmpresaTier.priceNote}
                  </strong>
                </p>
                <p className="text-xs text-graphite-500">{suggestedEmpresaTier.description}</p>
              </div>
            )}

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
              <Label htmlFor="companyName">{getCompanyNameLabel(accountType)}</Label>
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

            {accountType !== "GESTORIA" && (
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

          <LegalFooterLinks />
        </CardContent>
      </Card>
    </div>
  )
}

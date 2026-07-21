"use client"

import Link from "next/link"
import { KeyRound, Settings, Shield, UserCircle2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRequireAuth } from "@/components/auth-provider"
import { SubscriptionPlansPanel } from "@/components/settings/subscription-plans-panel"

const SETTINGS_LINKS = [
  {
    href: "/configuracion/certificado",
    title: "Certificado Digital & Verifactu",
    description: "Sube tu .p12/.pfx, contraseña y entorno AEAT para firmar facturas.",
    icon: KeyRound,
  },
]

export function AccountSettingsPage() {
  const { session, roleLabel, activeCompany } = useRequireAuth()

  if (!session) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm font-medium text-emerald-700">
          <Settings className="h-4 w-4" />
          Cuenta
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-pine-900 sm:text-3xl">
          Configuración de la Cuenta
        </h1>
        <p className="mt-1 text-sm text-graphite-500">
          Perfil de usuario y preferencias de la plataforma.
        </p>
      </div>

      <Card className="border-sand-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserCircle2 className="h-5 w-5 text-emerald-700" />
            <div>
              <CardTitle className="text-lg text-pine-900">Perfil</CardTitle>
              <CardDescription>Datos de la sesión activa (demo)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ProfileField label="Nombre" value={session.user.name} />
          <ProfileField label="Email" value={session.user.email} />
          <ProfileField label="Rol" value={roleLabel} />
          <ProfileField label="Empresa activa" value={activeCompany?.name ?? "—"} />
          <ProfileField label="Cuenta" value={session.user.accountName} />
        </CardContent>
      </Card>

      <div id="suscripcion">
        <SubscriptionPlansPanel />
      </div>

      <Card className="border-sand-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-emerald-700" />
            <div>
              <CardTitle className="text-lg text-pine-900">Seguridad y cumplimiento</CardTitle>
              <CardDescription>Accesos relacionados con firma electrónica</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {SETTINGS_LINKS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-start gap-3 rounded-xl border border-sand-200 bg-white p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <span>
                  <span className="block font-medium text-pine-900">{item.title}</span>
                  <span className="mt-1 block text-sm text-graphite-500">{item.description}</span>
                </span>
              </Link>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-graphite-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-pine-900">{value}</p>
    </div>
  )
}

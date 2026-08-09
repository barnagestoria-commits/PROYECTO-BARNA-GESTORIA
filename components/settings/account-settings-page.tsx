"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { KeyRound, Loader2, Pencil, Settings, Shield, UserCircle2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRequireAuth } from "@/components/auth-provider"
import { SubscriptionPlansPanel } from "@/components/settings/subscription-plans-panel"
import { apiFetch, type SessionResponse } from "@/lib/api-client"

const SETTINGS_LINKS = [
  {
    href: "/configuracion/certificado",
    title: "Certificado Digital & Verifactu",
    description: "Sube tu .p12/.pfx, contraseña y entorno AEAT para firmar facturas.",
    icon: KeyRound,
  },
]

interface ProfileFormState {
  name: string
  email: string
  phone: string
  accountName: string
  activeCompanyName: string
  activeCompanyCif: string
}

export function AccountSettingsPage() {
  const { session, roleLabel, activeCompany, refreshSession } = useRequireAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState<ProfileFormState>({
    name: "",
    email: "",
    phone: "",
    accountName: "",
    activeCompanyName: "",
    activeCompanyCif: "",
  })

  const canEditAccountName =
    session?.user.role === "ADMIN_GESTOR" ||
    session?.user.accountType === "CLIENTE_FINAL" ||
    session?.user.accountType === "EMPRESA"

  useEffect(() => {
    if (!session) return
    setForm({
      name: session.user.name,
      email: session.user.email,
      phone: session.user.phone ?? "",
      accountName: session.user.accountName,
      activeCompanyName: activeCompany?.name ?? "",
      activeCompanyCif: activeCompany?.cif ?? "",
    })
  }, [session, activeCompany?.name, activeCompany?.cif])

  if (!session) return null

  const resetForm = () => {
    setForm({
      name: session.user.name,
      email: session.user.email,
      phone: session.user.phone ?? "",
      accountName: session.user.accountName,
      activeCompanyName: activeCompany?.name ?? "",
      activeCompanyCif: activeCompany?.cif ?? "",
    })
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await apiFetch<SessionResponse>("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          ...(canEditAccountName ? { accountName: form.accountName } : {}),
          ...(activeCompany ? { activeCompanyName: form.activeCompanyName } : {}),
          ...(activeCompany ? { activeCompanyCif: form.activeCompanyCif || null } : {}),
        }),
      })
      await refreshSession()
      setIsEditing(false)
      setSuccessMessage("Perfil actualizado correctamente.")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar el perfil.")
    } finally {
      setIsSaving(false)
    }
  }

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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <UserCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <CardTitle className="text-lg text-pine-900">Perfil</CardTitle>
                  {!isEditing ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900"
                      onClick={() => {
                        setSuccessMessage(null)
                        setErrorMessage(null)
                        setIsEditing(true)
                      }}
                      aria-label="Editar perfil"
                      title="Editar perfil"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <CardDescription>Datos de tu usuario y cuenta activa</CardDescription>
              </div>
            </div>
            {isEditing ? (
              <div className="flex shrink-0 gap-2 self-end sm:self-start">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetForm()
                    setIsEditing(false)
                  }}
                  disabled={isSaving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
                <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Guardar
                </Button>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(successMessage || errorMessage) && (
            <div
              className={
                successMessage
                  ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                  : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              }
            >
              {successMessage ?? errorMessage}
            </div>
          )}

          {!isEditing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileField label="Nombre" value={session.user.name} />
              <ProfileField label="Email" value={session.user.email} />
              <ProfileField label="Teléfono" value={session.user.phone ?? "—"} />
              <ProfileField label="Rol" value={roleLabel} />
              <ProfileField label="Empresa activa" value={activeCompany?.name ?? "—"} />
              <ProfileField label="NIF / CIF" value={activeCompany?.cif ?? "—"} />
              <ProfileField label="Cuenta" value={session.user.accountName} />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileInput
                id="profile-name"
                label="Nombre"
                value={form.name}
                onChange={(value) => setForm((current) => ({ ...current, name: value }))}
              />
              <ProfileInput
                id="profile-email"
                label="Email"
                type="email"
                value={form.email}
                onChange={(value) => setForm((current) => ({ ...current, email: value }))}
              />
              <ProfileInput
                id="profile-phone"
                label="Teléfono"
                value={form.phone}
                onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
              />
              <ProfileField label="Rol" value={roleLabel} />
              {activeCompany ? (
                <>
                  <ProfileInput
                    id="profile-company"
                    label="Empresa activa"
                    value={form.activeCompanyName}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, activeCompanyName: value }))
                    }
                  />
                  <ProfileInput
                    id="profile-company-cif"
                    label="NIF / CIF"
                    value={form.activeCompanyCif}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, activeCompanyCif: value }))
                    }
                  />
                </>
              ) : (
                <>
                  <ProfileField label="Empresa activa" value="—" />
                  <ProfileField label="NIF / CIF" value="—" />
                </>
              )}
              {canEditAccountName ? (
                <ProfileInput
                  id="profile-account"
                  label="Nombre de la cuenta"
                  value={form.accountName}
                  onChange={(value) => setForm((current) => ({ ...current, accountName: value }))}
                />
              ) : (
                <ProfileField label="Cuenta" value={session.user.accountName} />
              )}
            </div>
          )}
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

function ProfileInput({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-graphite-500">
        {label}
      </Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

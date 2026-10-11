"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { KeyRound, Landmark, Loader2, Pencil, Receipt, Settings, Shield, UserCircle2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRequireAuth } from "@/components/auth-provider"
import { SubscriptionPlansPanel } from "@/components/settings/subscription-plans-panel"
import { GestoriaTeamPanel } from "@/components/settings/gestoria-team-panel"
import { apiFetch, type SessionResponse } from "@/lib/api-client"
import { formatIbanDisplay } from "@/lib/banking/iban"

const SETTINGS_LINKS = [
  {
    href: "/configuracion/plantilla-factura",
    title: "Plantilla de facturación emitida",
    description: "Diseño PDF, Registro Mercantil, QR Veri*factu y visibilidad de bloques.",
    icon: Receipt,
  },
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
  activityStartDate: string
  taxDirectDebitIban: string
  taxDirectDebitBank: string
  salesCollectionIban: string
  salesCollectionBank: string
}

function formatSpanishDate(iso: string | null | undefined): string {
  if (!iso) return "Sin informar"
  const [year, month, day] = iso.split("-")
  if (!year || !month || !day) return "Sin informar"
  return `${day}/${month}/${year}`
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
    activityStartDate: "",
    taxDirectDebitIban: "",
    taxDirectDebitBank: "",
    salesCollectionIban: "",
    salesCollectionBank: "",
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
      activityStartDate: activeCompany?.activityStartDate ?? "",
      taxDirectDebitIban: formatIbanDisplay(activeCompany?.taxDirectDebitIban),
      taxDirectDebitBank: activeCompany?.taxDirectDebitBank ?? "",
      salesCollectionIban: formatIbanDisplay(activeCompany?.salesCollectionIban),
      salesCollectionBank: activeCompany?.salesCollectionBank ?? "",
    })
  }, [
    session,
    activeCompany?.name,
    activeCompany?.cif,
    activeCompany?.activityStartDate,
    activeCompany?.taxDirectDebitIban,
    activeCompany?.taxDirectDebitBank,
    activeCompany?.salesCollectionIban,
    activeCompany?.salesCollectionBank,
  ])

  if (!session) return null

  const resetForm = () => {
    setForm({
      name: session.user.name,
      email: session.user.email,
      phone: session.user.phone ?? "",
      accountName: session.user.accountName,
      activeCompanyName: activeCompany?.name ?? "",
      activeCompanyCif: activeCompany?.cif ?? "",
      activityStartDate: activeCompany?.activityStartDate ?? "",
      taxDirectDebitIban: formatIbanDisplay(activeCompany?.taxDirectDebitIban),
      taxDirectDebitBank: activeCompany?.taxDirectDebitBank ?? "",
      salesCollectionIban: formatIbanDisplay(activeCompany?.salesCollectionIban),
      salesCollectionBank: activeCompany?.salesCollectionBank ?? "",
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
          ...(activeCompany ? { activityStartDate: form.activityStartDate || null } : {}),
          ...(activeCompany
            ? {
                taxDirectDebitIban: form.taxDirectDebitIban || null,
                taxDirectDebitBank: form.taxDirectDebitBank || null,
                salesCollectionIban: form.salesCollectionIban || null,
                salesCollectionBank: form.salesCollectionBank || null,
              }
            : {}),
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
              <ProfileField
                label="Fecha de alta"
                value={formatSpanishDate(activeCompany?.activityStartDate)}
              />
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
                  <ProfileInput
                    id="profile-activity-start"
                    label="Fecha de alta de autónomo / empresa"
                    type="date"
                    value={form.activityStartDate}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, activityStartDate: value }))
                    }
                  />
                </>
              ) : (
                <>
                  <ProfileField label="Empresa activa" value="—" />
                  <ProfileField label="NIF / CIF" value="—" />
                  <ProfileField label="Fecha de alta" value="—" />
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
          <p className="text-xs leading-relaxed text-graphite-500">
            La fecha de alta sirve para el modelo 130. Si el alta es de este ejercicio, se aplica la
            minoración de 100 € del art. 110.3.c del Reglamento del IRPF. Si es anterior, la minoración
            se calcula con el rendimiento del ejercicio previo que haya en los libros.
          </p>

          <div className="space-y-3 border-t border-sand-200 pt-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-emerald-700" />
              <p className="text-sm font-medium text-pine-900">Cuentas bancarias</p>
            </div>
            <BankAccountBlock
              title="Suscripción del programa"
              description="Cuenta donde se cobrará la cuota del programa. El cobro está desactivado hasta que se active el pago."
              iban=""
              bank=""
              disabled
              editing={false}
            />
            {activeCompany ? (
            <>
            <BankAccountBlock
              title="Domiciliación de impuestos"
              description="Cuenta donde Hacienda puede cargar el modelo 303 cuando el resultado es a ingresar. Si la dejas vacía, el fichero se genera para ingreso sin domiciliar."
              iban={isEditing ? form.taxDirectDebitIban : formatIbanDisplay(activeCompany?.taxDirectDebitIban)}
              bank={isEditing ? form.taxDirectDebitBank : activeCompany?.taxDirectDebitBank ?? ""}
              editing={isEditing}
              ibanId="profile-tax-iban"
              bankId="profile-tax-bank"
              onIbanChange={(value) => setForm((current) => ({ ...current, taxDirectDebitIban: value }))}
              onBankChange={(value) => setForm((current) => ({ ...current, taxDirectDebitBank: value }))}
            />
            <BankAccountBlock
              title="Cobro de facturas de venta"
              description="Cuenta que sale en las facturas emitidas para que el cliente te pague o le gires el recibo."
              iban={isEditing ? form.salesCollectionIban : formatIbanDisplay(activeCompany?.salesCollectionIban)}
              bank={isEditing ? form.salesCollectionBank : activeCompany?.salesCollectionBank ?? ""}
              editing={isEditing}
              ibanId="profile-sales-iban"
              bankId="profile-sales-bank"
              onIbanChange={(value) => setForm((current) => ({ ...current, salesCollectionIban: value }))}
              onBankChange={(value) => setForm((current) => ({ ...current, salesCollectionBank: value }))}
            />
            </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {session.user.accountType === "GESTORIA" && session.user.role === "ADMIN_GESTOR" ? (
        <GestoriaTeamPanel />
      ) : null}

      {session.user.role === "GESTOR" ? null : (
      <div id="suscripcion">
        <SubscriptionPlansPanel />
      </div>
      )}

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

function BankAccountBlock({
  title,
  description,
  iban,
  bank,
  editing,
  disabled = false,
  ibanId,
  bankId,
  onIbanChange,
  onBankChange,
}: {
  title: string
  description: string
  iban: string
  bank: string
  editing: boolean
  disabled?: boolean
  ibanId?: string
  bankId?: string
  onIbanChange?: (value: string) => void
  onBankChange?: (value: string) => void
}) {
  return (
    <div
      className={`rounded-xl border border-sand-200 p-3 ${disabled ? "bg-sand-50/80" : "bg-white"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-pine-900">{title}</p>
        {disabled ? (
          <span className="rounded-full bg-sand-200 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-graphite-500">
            Desactivado
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-graphite-500">{description}</p>
      {disabled || !editing ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ProfileField label="IBAN" value={disabled ? "—" : iban || "Sin informar"} />
          <ProfileField label="Banco" value={disabled ? "—" : bank || "Sin informar"} />
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ProfileInput
            id={ibanId ?? "iban"}
            label="IBAN"
            value={iban}
            onChange={onIbanChange ?? (() => undefined)}
            autoComplete="off"
            spellCheck={false}
          />
          <ProfileInput
            id={bankId ?? "bank"}
            label="Banco"
            value={bank}
            onChange={onBankChange ?? (() => undefined)}
          />
        </div>
      )}
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
  autoComplete,
  spellCheck,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
  spellCheck?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-graphite-500">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

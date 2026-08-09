"use client"

import { useEffect, useState } from "react"
import { Loader2, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api-client"
import { GestoriaPresentationConfigForm } from "@/components/contabilidad/gestoria-presentation-config-form"
import { CompanyCertificatePanel } from "@/components/settings/company-certificate-panel"
import {
  createEmptyGestoriaProfile,
  createId,
  ENTITY_TYPE_OPTIONS,
  type GestoriaActivity,
  type GestoriaBankAccount,
  type GestoriaClientDetailDto,
  type GestoriaClientProfileDto,
  type GestoriaLocale,
  type GestoriaRelatedPerson,
} from "@/lib/contabilidad/gestoria-client-profile-types"
import {
  createDefaultPresentationConfig,
  syncPresentationWithAccountingPlan,
} from "@/lib/contabilidad/gestoria-presentation-config"
import { cn } from "@/lib/utils"

interface EditGestoriaClientDialogProps {
  open: boolean
  companyId: string | null
  initialTab?: string
  onClose: () => void
  onSaved: () => void
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-graphite-600">{label}</Label>
      {children}
    </div>
  )
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-graphite-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-sand-300"
      />
      {label}
    </label>
  )
}

export function EditGestoriaClientDialog({
  open,
  companyId,
  initialTab = "general",
  onClose,
  onSaved,
}: EditGestoriaClientDialogProps) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [cif, setCif] = useState("")
  const [profile, setProfile] = useState<GestoriaClientProfileDto>(
    createEmptyGestoriaProfile("01564"),
  )

  useEffect(() => {
    if (!open || !companyId) return

    setActiveTab(initialTab)
    setLoading(true)
    setError(null)

    void apiFetch<{ success: true; client: GestoriaClientDetailDto }>(
      `/api/companies/${companyId}`,
    )
      .then((data) => {
        setName(data.client.name)
        setCif(data.client.cif ?? "")
        setProfile(data.client.profile)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [companyId, open, initialTab])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!open || !companyId) return null

  const reloadClientIdentity = () => {
    void apiFetch<{ success: true; client: GestoriaClientDetailDto }>(`/api/companies/${companyId}`)
      .then((data) => {
        setName(data.client.name)
        setCif(data.client.cif ?? "")
      })
      .catch(() => undefined)
  }

  const updateProfile = (patch: Partial<GestoriaClientProfileDto>) => {
    setProfile((current) => ({ ...current, ...patch }))
  }

  const clientEntityType =
    profile.entityType === "PERSONA_FISICA" ? ("fisica" as const) : ("juridica" as const)

  const handleEntityTypeChange = (entityType: GestoriaClientProfileDto["entityType"]) => {
    const nextClientType = entityType === "PERSONA_FISICA" ? "fisica" : "juridica"
    const nextPlan =
      nextClientType === "fisica" ? "PGC_MICRO" : profile.accountingPlanType
    setProfile((current) => ({
      ...current,
      entityType,
      accountingPlanType: nextClientType === "fisica" ? "PGC_MICRO" : current.accountingPlanType,
      presentation: syncPresentationWithAccountingPlan(
        createDefaultPresentationConfig(nextClientType),
        nextPlan,
        nextClientType,
      ),
    }))
  }

  const handleAccountingPlanChange = (
    accountingPlanType: GestoriaClientProfileDto["accountingPlanType"],
  ) => {
    setProfile((current) => ({
      ...current,
      accountingPlanType,
      presentation: syncPresentationWithAccountingPlan(
        current.presentation,
        accountingPlanType,
        clientEntityType,
      ),
    }))
  }

  const handlePresentationChange = (
    presentation: GestoriaClientProfileDto["presentation"],
  ) => {
    setProfile((current) => ({
      ...current,
      presentation,
      impresos: {
        ...current.impresos,
        model232: presentation.model232Enabled,
      },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await apiFetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, cif, profile }),
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cliente.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center p-2 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-sand-300 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-gestoria-client-title"
      >
        <div className="flex items-start justify-between border-b border-sand-200 bg-sand-50 px-4 py-3">
          <div>
            <h2 id="edit-gestoria-client-title" className="text-lg font-semibold text-pine-900">
              Mantenimiento de cliente · {profile.clientCode}
            </h2>
            <p className="text-sm text-graphite-500">
              Ficha de cliente · identificación, impresos, bancos, actividades y opciones contables
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-graphite-500 hover:bg-white hover:text-pine-900"
            aria-label="Cerrar ventana"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-sand-100 p-1">
                <TabsTrigger value="general">Datos generales</TabsTrigger>
                <TabsTrigger value="certificado">Certificado digital</TabsTrigger>
                <TabsTrigger value="presentacion">Presentación fiscal</TabsTrigger>
                <TabsTrigger value="impresos">Impresos</TabsTrigger>
                <TabsTrigger value="bancos">Bancos</TabsTrigger>
                <TabsTrigger value="actividades">Actividades</TabsTrigger>
                <TabsTrigger value="parametrizacion">Parametrización</TabsTrigger>
                <TabsTrigger value="personas">Personas</TabsTrigger>
                <TabsTrigger value="obligaciones">Obligaciones</TabsTrigger>
                <TabsTrigger value="locales">Locales</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Código cliente">
                    <Input value={profile.clientCode} readOnly className="font-mono" />
                  </Field>
                  <Field label="N.I.F. / C.I.F.">
                    <Input value={cif} onChange={(e) => setCif(e.target.value.toUpperCase())} />
                  </Field>
                  <Field label="Nombre / Razón social" className="md:col-span-2">
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field label="Tipo de empresa">
                    <select
                      value={profile.entityType}
                      onChange={(e) =>
                        handleEntityTypeChange(
                          e.target.value as GestoriaClientProfileDto["entityType"],
                        )
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {ENTITY_TYPE_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Responsable / Técnico contable">
                    <Input
                      value={profile.technicianName}
                      onChange={(e) => updateProfile({ technicianName: e.target.value })}
                      placeholder="Nombre del gestor o técnico"
                    />
                  </Field>
                  <Field label="Código responsable (Res)">
                    <Input
                      value={profile.responsibleCode}
                      onChange={(e) => updateProfile({ responsibleCode: e.target.value })}
                      placeholder="035"
                      className="font-mono"
                    />
                  </Field>
                  <Field label="Correo electrónico">
                    <Input
                      type="email"
                      value={profile.email}
                      onChange={(e) => updateProfile({ email: e.target.value })}
                    />
                  </Field>
                  <Field label="Teléfono">
                    <Input
                      value={profile.phone}
                      onChange={(e) => updateProfile({ phone: e.target.value })}
                    />
                  </Field>
                  <Field label="Camino de acceso" className="md:col-span-2">
                    <Input
                      value={profile.accessPath}
                      onChange={(e) => updateProfile({ accessPath: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="rounded-lg border border-sand-200 p-4">
                  <p className="mb-3 text-sm font-semibold text-pine-900">Domicilio</p>
                  <div className="grid gap-3 md:grid-cols-4">
                    <Field label="Vía">
                      <Input
                        value={profile.streetType}
                        onChange={(e) => updateProfile({ streetType: e.target.value })}
                      />
                    </Field>
                    <Field label="Nombre vía" className="md:col-span-2">
                      <Input
                        value={profile.streetName}
                        onChange={(e) => updateProfile({ streetName: e.target.value })}
                      />
                    </Field>
                    <Field label="Núm.">
                      <Input
                        value={profile.streetNumber}
                        onChange={(e) => updateProfile({ streetNumber: e.target.value })}
                      />
                    </Field>
                    <Field label="Piso">
                      <Input
                        value={profile.floor}
                        onChange={(e) => updateProfile({ floor: e.target.value })}
                      />
                    </Field>
                    <Field label="Puerta">
                      <Input
                        value={profile.door}
                        onChange={(e) => updateProfile({ door: e.target.value })}
                      />
                    </Field>
                    <Field label="C.P.">
                      <Input
                        value={profile.postalCode}
                        onChange={(e) => updateProfile({ postalCode: e.target.value })}
                      />
                    </Field>
                    <Field label="Municipio">
                      <Input
                        value={profile.city}
                        onChange={(e) => updateProfile({ city: e.target.value })}
                      />
                    </Field>
                    <Field label="Provincia">
                      <Input
                        value={profile.province}
                        onChange={(e) => updateProfile({ province: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>

                {profile.entityType === "PERSONA_JURIDICA" && (
                  <div className="rounded-lg border border-sand-200 p-4">
                    <p className="mb-1 text-sm font-semibold text-pine-900">Registro Mercantil</p>
                    <p className="mb-3 text-xs text-graphite-600">
                      Datos obligatorios para sociedades (Código de Comercio). Se mostrarán en el pie de las
                      facturas emitidas.
                    </p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Provincia del registro" className="md:col-span-3">
                        <Input
                          value={profile.registroMercantil.provincia}
                          onChange={(e) =>
                            updateProfile({
                              registroMercantil: {
                                ...profile.registroMercantil,
                                provincia: e.target.value,
                              },
                            })
                          }
                          placeholder="Barcelona"
                        />
                      </Field>
                      {(
                        [
                          ["tomo", "Tomo"],
                          ["libro", "Libro"],
                          ["folio", "Folio"],
                          ["hoja", "Hoja"],
                          ["seccion", "Sección"],
                          ["inscripcion", "Inscripción"],
                        ] as const
                      ).map(([key, label]) => (
                        <Field key={key} label={label}>
                          <Input
                            value={profile.registroMercantil[key]}
                            onChange={(e) =>
                              updateProfile({
                                registroMercantil: {
                                  ...profile.registroMercantil,
                                  [key]: e.target.value,
                                },
                              })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 rounded-lg border border-sand-200 p-4">
                  <CheckboxField
                    label="Inmovilizado"
                    checked={Boolean(profile.modules.inmovilizado)}
                    onChange={(checked) =>
                      updateProfile({ modules: { ...profile.modules, inmovilizado: checked } })
                    }
                  />
                  <CheckboxField
                    label="Tesorería"
                    checked={Boolean(profile.modules.tesoreria)}
                    onChange={(checked) =>
                      updateProfile({ modules: { ...profile.modules, tesoreria: checked } })
                    }
                  />
                  <CheckboxField
                    label="Analítica"
                    checked={Boolean(profile.modules.analitica)}
                    onChange={(checked) =>
                      updateProfile({ modules: { ...profile.modules, analitica: checked } })
                    }
                  />
                  <CheckboxField
                    label="Prorrata IVA"
                    checked={Boolean(profile.prorrata.enabled)}
                    onChange={(checked) =>
                      updateProfile({ prorrata: { ...profile.prorrata, enabled: checked } })
                    }
                  />
                </div>
              </TabsContent>

              <TabsContent value="certificado" className="space-y-4">
                <CompanyCertificatePanel
                  companyId={companyId}
                  title="Certificado digital del cliente"
                  description="Sube el certificado FNMT/AEAT del cliente para vincular la presentación de impuestos (303, 111, 349…) con Hacienda. El NIF extraído se usará en los borradores fiscales."
                  onCertificateChange={() => {
                    reloadClientIdentity()
                    onSaved()
                  }}
                />
              </TabsContent>

              <TabsContent value="presentacion" className="space-y-4">
                <GestoriaPresentationConfigForm
                  entityType={clientEntityType}
                  accountingPlanType={profile.accountingPlanType}
                  presentation={profile.presentation}
                  onAccountingPlanChange={handleAccountingPlanChange}
                  onPresentationChange={handlePresentationChange}
                />
              </TabsContent>

              <TabsContent value="impresos" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["model111", "Modelo 111"],
                    ["model115", "Modelo 115"],
                    ["model123", "Modelo 123"],
                    ["model180", "Modelo 180"],
                    ["model190", "Modelo 190"],
                    ["model232", "Modelo 232"],
                    ["model303", "Modelo 303"],
                    ["model347", "Modelo 347"],
                    ["model349", "Modelo 349"],
                    ["model390", "Modelo 390"],
                  ].map(([key, label]) => (
                    <CheckboxField
                      key={key}
                      label={label}
                      checked={Boolean(profile.impresos[key as keyof typeof profile.impresos])}
                      onChange={(checked) =>
                        updateProfile({
                          impresos: { ...profile.impresos, [key]: checked },
                        })
                      }
                    />
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <CheckboxField
                    label="Presenta los impresos el despacho"
                    checked={Boolean(profile.impresos.presentsViaDespacho)}
                    onChange={(checked) =>
                      updateProfile({
                        impresos: { ...profile.impresos, presentsViaDespacho: checked },
                      })
                    }
                  />
                  <CheckboxField
                    label="IVA negativo a compensar"
                    checked={Boolean(profile.impresos.negativeVatCompensate)}
                    onChange={(checked) =>
                      updateProfile({
                        impresos: { ...profile.impresos, negativeVatCompensate: checked },
                      })
                    }
                  />
                  <CheckboxField
                    label="Suministro Inmediato de Información (SII)"
                    checked={Boolean(profile.impresos.siiEnabled)}
                    onChange={(checked) =>
                      updateProfile({
                        impresos: { ...profile.impresos, siiEnabled: checked },
                      })
                    }
                  />
                </div>
              </TabsContent>

              <TabsContent value="bancos" className="space-y-4">
                <BankEditor
                  title="Cuenta bancaria de cobro de cuota (gestoría)"
                  account={profile.feeBank}
                  onChange={(feeBank) => updateProfile({ feeBank })}
                  allowFeeFlag
                />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-pine-900">Bancos de la empresa</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateProfile({
                          bankAccounts: [
                            ...profile.bankAccounts,
                            { id: createId("bank"), isDefault: profile.bankAccounts.length === 0 },
                          ],
                        })
                      }
                    >
                      <Plus className="mr-1 h-4 w-4" /> Añadir banco
                    </Button>
                  </div>
                  {profile.bankAccounts.map((bank, index) => (
                    <BankEditor
                      key={bank.id}
                      title={`Cuenta ${index + 1}`}
                      account={bank}
                      onChange={(next) =>
                        updateProfile({
                          bankAccounts: profile.bankAccounts.map((item) =>
                            item.id === bank.id ? next : item,
                          ),
                        })
                      }
                      onRemove={() =>
                        updateProfile({
                          bankAccounts: profile.bankAccounts.filter((item) => item.id !== bank.id),
                        })
                      }
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="actividades" className="space-y-4">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateProfile({
                        activities: [
                          ...profile.activities,
                          { id: createId("act"), isMain: profile.activities.length === 0 },
                        ],
                      })
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" /> Añadir actividad
                  </Button>
                </div>
                {profile.activities.map((activity) => (
                  <ActivityEditor
                    key={activity.id}
                    activity={activity}
                    onChange={(next) =>
                      updateProfile({
                        activities: profile.activities.map((item) =>
                          item.id === activity.id ? next : item,
                        ),
                      })
                    }
                    onRemove={() =>
                      updateProfile({
                        activities: profile.activities.filter((item) => item.id !== activity.id),
                      })
                    }
                  />
                ))}
              </TabsContent>

              <TabsContent value="parametrizacion" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nº dígitos cuentas">
                    <Input
                      type="number"
                      value={profile.inmovilizadoParams.accountDigits ?? 8}
                      onChange={(e) =>
                        updateProfile({
                          inmovilizadoParams: {
                            ...profile.inmovilizadoParams,
                            accountDigits: Number.parseInt(e.target.value, 10) || 8,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Mes de cierre">
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={profile.inmovilizadoParams.closingMonth ?? 12}
                      onChange={(e) =>
                        updateProfile({
                          inmovilizadoParams: {
                            ...profile.inmovilizadoParams,
                            closingMonth: Number.parseInt(e.target.value, 10) || 12,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Número de referencia">
                    <Input
                      value={profile.inmovilizadoParams.referenceNumberMode ?? "Anual"}
                      onChange={(e) =>
                        updateProfile({
                          inmovilizadoParams: {
                            ...profile.inmovilizadoParams,
                            referenceNumberMode: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Prorrata (%)">
                    <Input
                      type="number"
                      step="0.01"
                      value={profile.prorrata.percent ?? 0}
                      onChange={(e) =>
                        updateProfile({
                          prorrata: {
                            ...profile.prorrata,
                            percent: Number.parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["splitVatAccounts", "Desglosar cuentas de IVA"],
                    ["splitWithholdingAccounts", "Desglosar cuentas de retenciones"],
                    ["autoDocumentNumber", "Número documento automático"],
                    ["issuesB2BInvoices", "Emite factura a empresas/profesionales"],
                  ].map(([key, label]) => (
                    <CheckboxField
                      key={key}
                      label={label}
                      checked={Boolean(
                        profile.inmovilizadoParams[
                          key as keyof typeof profile.inmovilizadoParams
                        ],
                      )}
                      onChange={(checked) =>
                        updateProfile({
                          inmovilizadoParams: {
                            ...profile.inmovilizadoParams,
                            [key]: checked,
                          },
                        })
                      }
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="personas" className="space-y-4">
                <PersonListEditor
                  title="Representantes / Administradores"
                  category="representante"
                  persons={profile.relatedPersons.filter((p) => p.category === "representante")}
                  onChange={(items) =>
                    updateProfile({
                      relatedPersons: [
                        ...profile.relatedPersons.filter((p) => p.category !== "representante"),
                        ...items,
                      ],
                    })
                  }
                />
                <PersonListEditor
                  title="Socios"
                  category="socio"
                  persons={profile.relatedPersons.filter((p) => p.category === "socio")}
                  onChange={(items) =>
                    updateProfile({
                      relatedPersons: [
                        ...profile.relatedPersons.filter((p) => p.category !== "socio"),
                        ...items,
                      ],
                    })
                  }
                />
                <PersonListEditor
                  title="Persona de contacto"
                  category="contacto"
                  persons={profile.relatedPersons.filter((p) => p.category === "contacto")}
                  onChange={(items) =>
                    updateProfile({
                      relatedPersons: [
                        ...profile.relatedPersons.filter((p) => p.category !== "contacto"),
                        ...items,
                      ],
                    })
                  }
                />
              </TabsContent>

              <TabsContent value="obligaciones" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["monthlyRefundRegistry", "Registro de devolución mensual"],
                    ["entityExemptCorporateTax", "Entidad exenta del Imp. Sociedades"],
                    ["largeCompany", "Gran empresa"],
                    ["equivalenceSurcharge", "Recargo de equivalencia"],
                    ["simplifiedVatRegime", "Régimen simplificado IVA"],
                    ["agricultureRegime", "Régimen agrario"],
                    ["incomeAttributionEntity", "Entidad en atribución de rentas"],
                  ].map(([key, label]) => (
                    <CheckboxField
                      key={key}
                      label={label}
                      checked={Boolean(
                        profile.formalObligations[
                          key as keyof typeof profile.formalObligations
                        ],
                      )}
                      onChange={(checked) =>
                        updateProfile({
                          formalObligations: {
                            ...profile.formalObligations,
                            [key]: checked,
                          },
                        })
                      }
                    />
                  ))}
                </div>
                <Field label="Observaciones">
                  <Textarea
                    value={profile.formalObligations.notes ?? ""}
                    onChange={(e) =>
                      updateProfile({
                        formalObligations: {
                          ...profile.formalObligations,
                          notes: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
              </TabsContent>

              <TabsContent value="locales" className="space-y-4">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateProfile({
                        locales: [
                          ...profile.locales,
                          { id: createId("loc"), code: String(profile.locales.length + 1).padStart(4, "0") },
                        ],
                      })
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" /> Añadir local
                  </Button>
                </div>
                {profile.locales.map((locale) => (
                  <LocaleEditor
                    key={locale.id}
                    locale={locale}
                    onChange={(next) =>
                      updateProfile({
                        locales: profile.locales.map((item) =>
                          item.id === locale.id ? next : item,
                        ),
                      })
                    }
                    onRemove={() =>
                      updateProfile({
                        locales: profile.locales.filter((item) => item.id !== locale.id),
                      })
                    }
                  />
                ))}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <div className="border-t border-sand-200 bg-sand-50 px-4 py-3">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-emerald-800 hover:bg-pine-900"
              disabled={loading || saving}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceptar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BankEditor({
  title,
  account,
  onChange,
  onRemove,
  allowFeeFlag,
}: {
  title: string
  account: GestoriaBankAccount | null
  onChange: (account: GestoriaBankAccount) => void
  onRemove?: () => void
  allowFeeFlag?: boolean
}) {
  const value = account ?? { id: createId("bank") }

  const patch = (next: Partial<GestoriaBankAccount>) => onChange({ ...value, ...next })

  return (
    <div className="rounded-lg border border-sand-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-pine-900">{title}</p>
        {onRemove && (
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Entidad">
          <Input value={value.entity ?? ""} onChange={(e) => patch({ entity: e.target.value })} />
        </Field>
        <Field label="Oficina">
          <Input value={value.office ?? ""} onChange={(e) => patch({ office: e.target.value })} />
        </Field>
        <Field label="IBAN" className="md:col-span-2">
          <Input value={value.iban ?? ""} onChange={(e) => patch({ iban: e.target.value })} />
        </Field>
        <Field label="Cuenta contable">
          <Input
            value={value.accountCode ?? ""}
            onChange={(e) => patch({ accountCode: e.target.value })}
            className="font-mono"
          />
        </Field>
        <Field label="Nombre banco">
          <Input
            value={value.bankName ?? ""}
            onChange={(e) => patch({ bankName: e.target.value })}
          />
        </Field>
      </div>
      {allowFeeFlag && (
        <div className="mt-3">
          <CheckboxField
            label="Cuenta bancaria para cobro de cuota de gestoría"
            checked={Boolean(value.isFeeAccount ?? true)}
            onChange={(checked) => patch({ isFeeAccount: checked })}
          />
        </div>
      )}
    </div>
  )
}

function ActivityEditor({
  activity,
  onChange,
  onRemove,
}: {
  activity: GestoriaActivity
  onChange: (activity: GestoriaActivity) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg border border-sand-200 p-4">
      <div className="mb-3 flex justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Epígrafe IAE">
          <Input
            value={activity.epigraph ?? ""}
            onChange={(e) => onChange({ ...activity, epigraph: e.target.value })}
          />
        </Field>
        <Field label="Descripción" className="md:col-span-2">
          <Input
            value={activity.description ?? ""}
            onChange={(e) => onChange({ ...activity, description: e.target.value })}
          />
        </Field>
        <Field label="Régimen IVA">
          <Input
            value={activity.vatRegime ?? "Ordinario"}
            onChange={(e) => onChange({ ...activity, vatRegime: e.target.value })}
          />
        </Field>
        <Field label="Estimación">
          <Input
            value={activity.estimation ?? ""}
            onChange={(e) => onChange({ ...activity, estimation: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-4">
        <CheckboxField
          label="Actividad principal"
          checked={Boolean(activity.isMain)}
          onChange={(checked) => onChange({ ...activity, isMain: checked })}
        />
        <CheckboxField
          label="Acogida a criterio de caja"
          checked={Boolean(activity.cashCriteria)}
          onChange={(checked) => onChange({ ...activity, cashCriteria: checked })}
        />
        <CheckboxField
          label="SII"
          checked={Boolean(activity.sii)}
          onChange={(checked) => onChange({ ...activity, sii: checked })}
        />
      </div>
    </div>
  )
}

function PersonListEditor({
  title,
  category,
  persons,
  onChange,
}: {
  title: string
  category: GestoriaRelatedPerson["category"]
  persons: GestoriaRelatedPerson[]
  onChange: (persons: GestoriaRelatedPerson[]) => void
}) {
  return (
    <div className="rounded-lg border border-sand-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-pine-900">{title}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange([...persons, { id: createId("person"), category, name: "" }])
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Añadir
        </Button>
      </div>
      {persons.map((person) => (
        <div key={person.id} className="mb-3 grid gap-2 md:grid-cols-4">
          <Input
            placeholder="Nombre"
            value={person.name}
            onChange={(e) =>
              onChange(
                persons.map((item) =>
                  item.id === person.id ? { ...item, name: e.target.value } : item,
                ),
              )
            }
          />
          <Input
            placeholder="NIF"
            value={person.nif ?? ""}
            onChange={(e) =>
              onChange(
                persons.map((item) =>
                  item.id === person.id ? { ...item, nif: e.target.value } : item,
                ),
              )
            }
          />
          <Input
            placeholder="Cargo"
            value={person.role ?? ""}
            onChange={(e) =>
              onChange(
                persons.map((item) =>
                  item.id === person.id ? { ...item, role: e.target.value } : item,
                ),
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange(persons.filter((item) => item.id !== person.id))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}

function LocaleEditor({
  locale,
  onChange,
  onRemove,
}: {
  locale: GestoriaLocale
  onChange: (locale: GestoriaLocale) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg border border-sand-200 p-4">
      <div className="mb-3 flex justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Código">
          <Input
            value={locale.code}
            onChange={(e) => onChange({ ...locale, code: e.target.value })}
            className="font-mono"
          />
        </Field>
        <Field label="Ref. catastral" className="md:col-span-2">
          <Input
            value={locale.cadastralRef ?? ""}
            onChange={(e) => onChange({ ...locale, cadastralRef: e.target.value })}
          />
        </Field>
        <Field label="Vía" className="md:col-span-2">
          <Input
            value={locale.streetName ?? ""}
            onChange={(e) => onChange({ ...locale, streetName: e.target.value })}
          />
        </Field>
        <Field label="Número">
          <Input
            value={locale.streetNumber ?? ""}
            onChange={(e) => onChange({ ...locale, streetNumber: e.target.value })}
          />
        </Field>
        <Field label="Municipio">
          <Input
            value={locale.city ?? ""}
            onChange={(e) => onChange({ ...locale, city: e.target.value })}
          />
        </Field>
        <Field label="C.P.">
          <Input
            value={locale.postalCode ?? ""}
            onChange={(e) => onChange({ ...locale, postalCode: e.target.value })}
          />
        </Field>
        <Field label="Superficie m²">
          <Input
            type="number"
            value={locale.surfaceM2 ?? ""}
            onChange={(e) =>
              onChange({
                ...locale,
                surfaceM2: Number.parseFloat(e.target.value) || undefined,
              })
            }
          />
        </Field>
      </div>
    </div>
  )
}

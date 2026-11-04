"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, X } from "lucide-react"
import { CompanyCertificatePanel } from "@/components/settings/company-certificate-panel"
import { CorporateCensusFields } from "@/components/company/corporate-census-fields"
import { VatCensusFields } from "@/components/company/vat-census-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api-client"
import { formatIbanDisplay } from "@/lib/banking/iban"
import type { CorporateTaxCharacter } from "@/lib/company/corporate-tax"
import type { CompanySiiMode } from "@/lib/company/sii"
import type { OnboardingTourStepDefinition } from "@/lib/onboarding/types"

const DOCUMENT_STEPS = new Set(["certificate", "census"])

export function MobileOnboardingWizard({
  open,
  step,
  index,
  total,
  onBack,
  onNext,
  onPause,
  onSkip,
}: {
  open: boolean
  step: OnboardingTourStepDefinition | undefined
  index: number
  total: number
  onBack: () => void
  onNext: () => void
  onPause: () => void
  onSkip: () => void
}) {
  const router = useRouter()
  const { session, activeCompany, refreshSession } = useAuth()
  const [docked, setDocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmWithoutFile, setConfirmWithoutFile] = useState(false)
  const [companyName, setCompanyName] = useState("")
  const [cif, setCif] = useState("")
  const [cnae, setCnae] = useState("")
  const [activityStartDate, setActivityStartDate] = useState("")
  const [taxIban, setTaxIban] = useState("")
  const [character, setCharacter] = useState<CorporateTaxCharacter>("SOCIEDAD")
  const [siiMode, setSiiMode] = useState<CompanySiiMode>("NONE")
  const [cashBasisSubject, setCashBasisSubject] = useState(false)
  const [cashBasisRecipient, setCashBasisRecipient] = useState(false)

  useEffect(() => {
    setDocked(false)
    setError(null)
    setConfirmWithoutFile(false)
  }, [step?.id])

  useEffect(() => {
    if (!activeCompany) return
    setCompanyName(activeCompany.name)
    setCif(activeCompany.cif ?? "")
    setCnae(activeCompany.cnae ?? "")
    setActivityStartDate(activeCompany.activityStartDate ?? "")
    setTaxIban(formatIbanDisplay(activeCompany.taxDirectDebitIban))
    setCharacter(activeCompany.corporateTaxCharacter ?? "SOCIEDAD")
    setSiiMode(activeCompany.siiMode ?? "NONE")
    setCashBasisSubject(Boolean(activeCompany.cashBasisSubject))
    setCashBasisRecipient(Boolean(activeCompany.cashBasisRecipient))
  }, [activeCompany])

  useEffect(() => {
    if (!open || docked) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [docked, open])

  if (!open || !step || !session) return null

  const progress = Math.round(((index + 1) / total) * 100)
  const interactive = step.id === "profile" || step.id === "certificate" || step.id === "census" || step.id === "profile-rest"

  const saveProfile = async (body: Record<string, unknown>) => {
    setSaving(true)
    setError(null)
    try {
      await apiFetch("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      await refreshSession()
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la ficha.")
      return false
    } finally {
      setSaving(false)
    }
  }

  const continueStep = async () => {
    if (step.id === "profile") {
      if (!companyName.trim()) {
        setError("Escribe el nombre o la razón social.")
        return
      }
      const saved = await saveProfile({
        ...(activeCompany ? { activeCompanyName: companyName.trim() } : {}),
        ...(activeCompany ? { activeCompanyCif: cif || null } : {}),
      })
      if (!saved) return
    }

    if (step.id === "profile-rest") {
      const saved = await saveProfile({
        ...(activeCompany
          ? {
              cnae: cnae || null,
              activityStartDate: activityStartDate || null,
              taxDirectDebitIban: taxIban || null,
              corporateTaxCharacter: character,
              siiMode,
              cashBasisSubject,
              cashBasisRecipient,
            }
          : {}),
      })
      if (!saved) return
    }

    if (DOCUMENT_STEPS.has(step.id) && !confirmWithoutFile) {
      const present = await documentIsPresent(step.id, activeCompany?.censusDocumentName)
      if (!present) {
        setConfirmWithoutFile(true)
        setError(
          step.id === "certificate"
            ? "Aún no hay certificado. Súbelo en esta pantalla o pulsa otra vez para seguir sin él."
            : "Aún no hay un 036 contrastado. Súbelo en esta pantalla o pulsa otra vez para seguir sin él.",
        )
        return
      }
    }

    onNext()
  }

  if (docked) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-sand-200 bg-white px-4 py-3 shadow-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
          Guía {index + 1} de {total}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-pine-900">{step.title}</p>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setDocked(false)}>
            Volver a la guía
          </Button>
          <Button type="button" className="h-11 flex-1 bg-emerald-800 hover:bg-pine-900" onClick={onNext}>
            Siguiente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[10050] flex flex-col bg-white">
      <header className="border-b border-sand-200 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Paso {index + 1} de {total}
          </p>
          <button
            type="button"
            onClick={onPause}
            className="rounded-full p-2 text-graphite-500 hover:bg-sand-100"
            aria-label="Pausar la guía"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand-100">
          <div className="h-full rounded-full bg-emerald-700" style={{ width: `${progress}%` }} />
        </div>
        <h2 className="mt-3 text-xl font-bold text-pine-900">{step.title}</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="text-sm leading-relaxed text-graphite-600">{plainText(step.content)}</p>
        <div className="mt-4">
          {step.id === "profile" ? (
            <div className="space-y-4">
              <Field label="Nombre o razón social" value={companyName} onChange={setCompanyName} />
              <Field label="NIF / CIF" value={cif} onChange={(value) => setCif(value.toUpperCase())} />
            </div>
          ) : null}
          {step.id === "certificate" ? (
            <CompanyCertificatePanel
              companyId={activeCompany?.id}
              title="Sube el certificado"
              description="Pulsa el recuadro y elige el archivo .p12 o .pfx, igual que cuando una app pide una foto del documento. Después escribe la contraseña y guarda."
            />
          ) : null}
          {step.id === "census" && activeCompany ? (
            <CorporateCensusFields
              companyId={activeCompany.id}
              profile={{
                cif,
                cnae,
                corporateTaxCharacter: character,
                siiMode,
                cashBasisSubject,
              }}
              storedFileName={activeCompany.censusDocumentName}
              storedExtractedAt={activeCompany.censusExtractedAt}
              storedExtractedJson={activeCompany.censusExtractedJson}
              onCharacterChange={setCharacter}
              onApply={({ suggestion, document }) => {
                if (suggestion.cif) setCif(suggestion.cif)
                if (suggestion.cnae) setCnae(suggestion.cnae)
                if (suggestion.corporateTaxCharacter) setCharacter(suggestion.corporateTaxCharacter)
                if (suggestion.siiMode) setSiiMode(suggestion.siiMode)
                if (suggestion.cashBasisSubject !== undefined) {
                  setCashBasisSubject(suggestion.cashBasisSubject)
                }
                void saveProfile({
                  ...(suggestion.cif ? { activeCompanyCif: suggestion.cif } : {}),
                  ...(suggestion.cnae ? { cnae: suggestion.cnae } : {}),
                  ...(suggestion.corporateTaxCharacter
                    ? { corporateTaxCharacter: suggestion.corporateTaxCharacter }
                    : {}),
                  ...(suggestion.siiMode ? { siiMode: suggestion.siiMode } : {}),
                  ...(suggestion.cashBasisSubject !== undefined
                    ? { cashBasisSubject: suggestion.cashBasisSubject }
                    : {}),
                  censusDocument: document,
                })
              }}
            />
          ) : null}
          {step.id === "profile-rest" ? (
            <div className="space-y-4">
              <Field
                label="CNAE de la actividad principal"
                value={cnae}
                onChange={(value) => setCnae(value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
              />
              <Field
                label="Fecha de alta"
                value={activityStartDate}
                onChange={setActivityStartDate}
                type="date"
              />
              <Field
                label="IBAN para los impuestos"
                value={taxIban}
                onChange={setTaxIban}
                autoComplete="off"
              />
              <VatCensusFields
                value={{ siiMode, cashBasisSubject, cashBasisRecipient }}
                onChange={(next) => {
                  setSiiMode(next.siiMode)
                  setCashBasisSubject(next.cashBasisSubject)
                  setCashBasisRecipient(next.cashBasisRecipient)
                }}
              />
            </div>
          ) : null}
          {!interactive ? (
            <p className="mt-2 text-sm leading-relaxed text-graphite-600">
              Abre la pantalla para verlo en el programa. La guía se queda abajo para que puedas seguir.
            </p>
          ) : null}
        </div>
        {error ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </p>
        ) : null}
      </div>

      <footer className="border-t border-sand-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {!interactive ? (
          <Button
            type="button"
            variant="outline"
            className="mb-2 h-12 w-full text-base"
            onClick={() => {
              router.push(step.route)
              setDocked(true)
            }}
          >
            Abrir esta pantalla
          </Button>
        ) : null}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 text-base"
            onClick={index === 0 ? onPause : onBack}
            disabled={saving}
          >
            {index === 0 ? "Ahora no" : "Atrás"}
          </Button>
          <Button
            type="button"
            className="h-12 flex-[1.4] bg-emerald-800 text-base hover:bg-pine-900"
            onClick={() => void continueStep()}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {index + 1 === total ? "Empezar" : "Continuar"}
          </Button>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="mt-3 w-full text-center text-sm text-graphite-500"
        >
          Saltar la guía
        </button>
      </footer>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  inputMode?: "numeric" | "text"
  autoComplete?: string
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-")
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm text-graphite-600">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 text-base"
      />
    </div>
  )
}

function plainText(value: string): string {
  return value.replace(/\*\*/g, "")
}

async function documentIsPresent(stepId: string, censusName: string | null | undefined): Promise<boolean> {
  if (stepId === "census") return Boolean(censusName)
  try {
    const response = await apiFetch<{ success: true; certificate: unknown }>("/api/certificate")
    return Boolean(response.certificate)
  } catch {
    return false
  }
}

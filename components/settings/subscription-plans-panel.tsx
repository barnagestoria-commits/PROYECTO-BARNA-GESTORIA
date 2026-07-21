"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Briefcase,
  Building,
  Check,
  ChevronDown,
  Crown,
  Factory,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch, type SessionResponse } from "@/lib/api-client"
import { suggestEmpresaTier } from "@/lib/settings/empresa-tier-evaluator"
import {
  ACCOUNT_TYPE_LABELS,
  AUTONOMO_PLAN,
  DEFAULT_EMPRESA_TIER_ID,
  DEFAULT_GESTORIA_TIER_ID,
  EMPRESA_FIRST_YEAR_EVALUATION_NOTE,
  EMPRESA_PLAN_FEATURES,
  EMPRESA_SUBSCRIPTION_TIERS,
  GESTORIA_PLAN_FEATURES,
  GESTORIA_SUBSCRIPTION_TIERS,
  canUpgradeAccountType,
  canUpgradeEmpresaTier,
  canUpgradeGestoriaTier,
  formatEmpresaTierCriteria,
  getEmpresaTierById,
  getGestoriaTierById,
  getPlanSummary,
  type EmpresaSubscriptionTier,
  type GestoriaSubscriptionTier,
} from "@/lib/settings/subscription-plans"
import {
  getEmpresaEvaluationProgress,
  loadEmpresaSubscriptionStartedAt,
  loadStoredEmpresaSizing,
  loadStoredEmpresaTierId,
  loadStoredGestoriaTierId,
  saveEmpresaSubscriptionStartedAt,
  saveStoredEmpresaSizing,
  saveStoredEmpresaTierId,
  saveStoredGestoriaTierId,
} from "@/lib/settings/subscription-storage"
import { cn } from "@/lib/utils"

export function SubscriptionPlansPanel() {
  const { session, refreshSession } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [activeGestoriaTierId, setActiveGestoriaTierId] = useState<string | null>(null)
  const [activeEmpresaTierId, setActiveEmpresaTierId] = useState<string | null>(null)
  const [selectedGestoriaTierId, setSelectedGestoriaTierId] = useState(DEFAULT_GESTORIA_TIER_ID)
  const [selectedEmpresaTierId, setSelectedEmpresaTierId] = useState(DEFAULT_EMPRESA_TIER_ID)
  const [annualRevenue, setAnnualRevenue] = useState("250000")
  const [monthlyMovements, setMonthlyMovements] = useState("80")
  const [empresaStartedAt, setEmpresaStartedAt] = useState<string | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null,
  )

  useEffect(() => {
    setActiveGestoriaTierId(loadStoredGestoriaTierId())
    const storedEmpresaTier = loadStoredEmpresaTierId()
    setActiveEmpresaTierId(storedEmpresaTier)
    if (storedEmpresaTier) setSelectedEmpresaTierId(storedEmpresaTier)

    const sizing = loadStoredEmpresaSizing()
    if (sizing) {
      setAnnualRevenue(String(sizing.annualRevenueEuros))
      setMonthlyMovements(String(sizing.monthlyBankMovements))
    }

    setEmpresaStartedAt(loadEmpresaSubscriptionStartedAt())
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.hash === "#suscripcion") {
      setExpanded(true)
      document.getElementById("suscripcion")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [])

  const suggestedEmpresaTier = useMemo(
    () =>
      suggestEmpresaTier({
        annualRevenueEuros: Number(annualRevenue) || 0,
        monthlyBankMovements: Number(monthlyMovements) || 0,
      }),
    [annualRevenue, monthlyMovements],
  )

  useEffect(() => {
    if (session?.user.accountType !== "EMPRESA") return
    setSelectedEmpresaTierId(suggestedEmpresaTier.id)
  }, [suggestedEmpresaTier.id, session?.user.accountType])

  if (!session) return null

  const isGestoria = session.user.accountType === "GESTORIA"
  const isEmpresa = session.user.accountType === "EMPRESA"
  const evaluation = getEmpresaEvaluationProgress(empresaStartedAt)

  const planSummary = getPlanSummary(session.user.accountType, {
    gestoriaTierId: activeGestoriaTierId ?? DEFAULT_GESTORIA_TIER_ID,
    empresaTierId: activeEmpresaTierId ?? suggestedEmpresaTier.id,
  })

  const currentSummary = isGestoria
    ? planSummary.name
    : isEmpresa
      ? planSummary.name
      : `${AUTONOMO_PLAN.name} · ${AUTONOMO_PLAN.priceLabel}/mes`

  const handleContractEmpresa = async (tierId: string) => {
    const tier = getEmpresaTierById(tierId)
    if (!tier) return

    const revenue = Number(annualRevenue)
    const movements = Number(monthlyMovements)
    if (!revenue || !movements) {
      setFeedback({
        tone: "error",
        message: "Indica facturación anual y movimientos bancarios mensuales estimados.",
      })
      return
    }

    const upgradingAccount = canUpgradeAccountType(session.user.accountType, "EMPRESA")
    const upgradingTier = isEmpresa && canUpgradeEmpresaTier(activeEmpresaTierId, tierId)

    if (!upgradingAccount && !upgradingTier) return

    setUpgrading(true)
    setFeedback(null)

    try {
      const result = await apiFetch<SessionResponse & { message?: string }>(
        "/api/account/upgrade",
        {
          method: "POST",
          body: JSON.stringify({
            targetAccountType: "EMPRESA",
            empresaTierId: tierId,
          }),
        },
      )

      saveStoredEmpresaTierId(tierId)
      saveStoredEmpresaSizing({
        annualRevenueEuros: revenue,
        monthlyBankMovements: movements,
      })
      if (!empresaStartedAt) {
        const started = new Date().toISOString()
        saveEmpresaSubscriptionStartedAt(started)
        setEmpresaStartedAt(started)
      }

      setActiveEmpresaTierId(tierId)
      setSelectedEmpresaTierId(tierId)
      await refreshSession()
      setExpanded(true)
      setFeedback({
        tone: "success",
        message: result.message ?? `${tier.name} contratado.`,
      })
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "No se pudo completar la contratación del plan.",
      })
    } finally {
      setUpgrading(false)
    }
  }

  const handleContractGestoria = async (tierId: string) => {
    const tier = getGestoriaTierById(tierId)
    if (!tier) return

    const upgradingAccount = canUpgradeAccountType(session.user.accountType, "GESTORIA")
    const upgradingTier = isGestoria && canUpgradeGestoriaTier(activeGestoriaTierId, tierId)

    if (!upgradingAccount && !upgradingTier) return

    setUpgrading(true)
    setFeedback(null)

    try {
      const result = await apiFetch<SessionResponse & { message?: string }>(
        "/api/account/upgrade",
        {
          method: "POST",
          body: JSON.stringify({
            targetAccountType: "GESTORIA",
            gestoriaTierId: tierId,
          }),
        },
      )

      saveStoredGestoriaTierId(tierId)
      setActiveGestoriaTierId(tierId)
      setSelectedGestoriaTierId(tierId)
      await refreshSession()
      setExpanded(true)
      setFeedback({
        tone: "success",
        message:
          result.message ??
          `Plan Gestoría contratado: hasta ${tier.maxClients} clientes por ${tier.priceLabel}/mes.`,
      })
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "No se pudo completar la contratación del plan.",
      })
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <Card className="border-sand-200 shadow-sm">
      <CardHeader className="pb-3">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 text-left"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <CardTitle className="text-lg text-pine-900">Tipo de cuenta y suscripción</CardTitle>
              <CardDescription>
                Plan actual:{" "}
                <span className="font-medium text-pine-900">{currentSummary}</span>
              </CardDescription>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
              {planSummary.shortLabel}
            </Badge>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-graphite-400 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </div>
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6 border-t border-sand-100 pt-4">
          <p className="text-sm text-graphite-500">
            Mejora tu plan sin crear una cuenta nueva.{" "}
            <strong className="font-medium text-pine-900">Autónomo: 100 €/mes</strong> ·{" "}
            <strong className="font-medium text-pine-900">Empresa: según facturación y movimientos</strong>{" "}
            · <strong className="font-medium text-pine-900">Gestoría: desde 1.000 €/mes</strong>.
          </p>

          {feedback && (
            <div
              className={cn(
                "rounded-xl border px-4 py-3 text-sm",
                feedback.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700",
              )}
              role="status"
            >
              {feedback.message}
            </div>
          )}

          <AutonomoPlanCard isCurrent={session.user.accountType === "CLIENTE_FINAL"} />

          <EmpresaPlanSection
            isEmpresa={isEmpresa}
            activeTierId={activeEmpresaTierId}
            selectedTierId={selectedEmpresaTierId}
            suggestedTierId={suggestedEmpresaTier.id}
            annualRevenue={annualRevenue}
            monthlyMovements={monthlyMovements}
            evaluationLabel={evaluation.reviewLabel}
            onAnnualRevenueChange={setAnnualRevenue}
            onMonthlyMovementsChange={setMonthlyMovements}
            onSelectTier={setSelectedEmpresaTierId}
            canUpgradeAccount={canUpgradeAccountType(session.user.accountType, "EMPRESA")}
            isUpgrading={upgrading}
            onContract={handleContractEmpresa}
          />

          <GestoriaTiersSection
            isGestoria={isGestoria}
            activeTierId={activeGestoriaTierId ?? (isGestoria ? DEFAULT_GESTORIA_TIER_ID : null)}
            selectedTierId={selectedGestoriaTierId}
            onSelectTier={setSelectedGestoriaTierId}
            isUpgrading={upgrading}
            canUpgradeAccount={canUpgradeAccountType(session.user.accountType, "GESTORIA")}
            onContract={handleContractGestoria}
          />
        </CardContent>
      )}
    </Card>
  )
}

function AutonomoPlanCard({ isCurrent }: { isCurrent: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        isCurrent ? "border-emerald-300 bg-emerald-50/60" : "border-sand-200 bg-white",
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Building className="h-5 w-5 text-emerald-700" />
          <div>
            <p className="font-semibold text-pine-900">{AUTONOMO_PLAN.name}</p>
            <p className="text-xs text-graphite-500">{AUTONOMO_PLAN.description}</p>
          </div>
        </div>
        {isCurrent && (
          <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            Plan activo
          </Badge>
        )}
      </div>

      <p className="mb-4 text-2xl font-bold text-pine-900">
        {AUTONOMO_PLAN.priceLabel}
        <span className="text-sm font-normal text-graphite-500">{AUTONOMO_PLAN.priceNote}</span>
      </p>

      <ul className="mb-4 grid gap-2 sm:grid-cols-2">
        {AUTONOMO_PLAN.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-graphite-600">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
          <Crown className="mr-2 h-4 w-4" />
          Tu plan actual
        </Button>
      ) : (
        <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
          Contacta con soporte para cambiar a Autónomo
        </Button>
      )}
    </div>
  )
}

function EmpresaPlanSection({
  isEmpresa,
  activeTierId,
  selectedTierId,
  suggestedTierId,
  annualRevenue,
  monthlyMovements,
  evaluationLabel,
  onAnnualRevenueChange,
  onMonthlyMovementsChange,
  onSelectTier,
  canUpgradeAccount,
  isUpgrading,
  onContract,
}: {
  isEmpresa: boolean
  activeTierId: string | null
  selectedTierId: string
  suggestedTierId: string
  annualRevenue: string
  monthlyMovements: string
  evaluationLabel: string
  onAnnualRevenueChange: (value: string) => void
  onMonthlyMovementsChange: (value: string) => void
  onSelectTier: (tierId: string) => void
  canUpgradeAccount: boolean
  isUpgrading: boolean
  onContract: (tierId: string) => void
}) {
  const selectedTier = getEmpresaTierById(selectedTierId)

  return (
    <div className="space-y-4 rounded-xl border border-sand-200 p-4">
      <div className="flex items-start gap-2">
        <Factory className="mt-0.5 h-5 w-5 text-emerald-700" />
        <div>
          <h3 className="font-semibold text-pine-900">{ACCOUNT_TYPE_LABELS.EMPRESA}</h3>
          <p className="text-sm text-graphite-500">
            Cuenta en solitario para sociedades. La cuota depende de la cifra de negocios y del
            volumen de movimientos bancarios.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">Evaluación del primer año</p>
        <p className="mt-1 text-amber-800">{EMPRESA_FIRST_YEAR_EVALUATION_NOTE}</p>
        {isEmpresa && <p className="mt-2 text-xs font-medium text-amber-900">{evaluationLabel}</p>}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {EMPRESA_PLAN_FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-graphite-600">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="empresa-revenue">Facturación anual estimada (€)</Label>
          <Input
            id="empresa-revenue"
            type="number"
            min={1}
            value={annualRevenue}
            onChange={(e) => onAnnualRevenueChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="empresa-movements">Movimientos bancarios / mes</Label>
          <Input
            id="empresa-movements"
            type="number"
            min={1}
            value={monthlyMovements}
            onChange={(e) => onMonthlyMovementsChange(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-pine-900">
        Tramo recomendado según tus datos:{" "}
        <strong>{getEmpresaTierById(suggestedTierId)?.name}</strong>
      </p>

      <div className="overflow-hidden rounded-xl border border-sand-200">
        <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-sand-200 bg-sand-50/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-graphite-500 sm:grid-cols-[1fr_1fr_auto] sm:px-4">
          <span>Tramo</span>
          <span className="hidden sm:block">Criterios</span>
          <span className="text-right">Cuota provisional</span>
        </div>
        <ul className="divide-y divide-sand-100">
          {EMPRESA_SUBSCRIPTION_TIERS.map((tier) => (
            <EmpresaTierRow
              key={tier.id}
              tier={tier}
              isActive={isEmpresa && activeTierId === tier.id}
              isSelected={selectedTierId === tier.id}
              isSuggested={suggestedTierId === tier.id}
              canContract={
                canUpgradeAccount || canUpgradeEmpresaTier(activeTierId, tier.id)
              }
              isUpgrading={isUpgrading}
              onSelect={() => onSelectTier(tier.id)}
              onContract={() => onContract(tier.id)}
            />
          ))}
        </ul>
      </div>

      {selectedTier &&
        (canUpgradeAccount || (isEmpresa && canUpgradeEmpresaTier(activeTierId, selectedTierId))) && (
          <Button
            type="button"
            className="w-full bg-emerald-800 hover:bg-pine-900 sm:w-auto"
            onClick={() => onContract(selectedTierId)}
            disabled={isUpgrading}
          >
            {isUpgrading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {canUpgradeAccount
              ? `Contratar Empresa · ${selectedTier.name} (${selectedTier.priceLabel}${selectedTier.priceNote})`
              : `Ampliar a ${selectedTier.name}`}
          </Button>
        )}
    </div>
  )
}

function EmpresaTierRow({
  tier,
  isActive,
  isSelected,
  isSuggested,
  canContract,
  isUpgrading,
  onSelect,
  onContract,
}: {
  tier: EmpresaSubscriptionTier
  isActive: boolean
  isSelected: boolean
  isSuggested: boolean
  canContract: boolean
  isUpgrading: boolean
  onSelect: () => void
  onContract: () => void
}) {
  return (
    <li
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-3 sm:grid-cols-[1fr_1fr_auto] sm:px-4",
        isSelected && "bg-emerald-50/50",
        isActive && "bg-emerald-50/80",
      )}
    >
      <button type="button" className="flex min-w-0 items-center gap-2 text-left" onClick={onSelect}>
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
            isSelected ? "border-emerald-600 bg-emerald-600" : "border-sand-300 bg-white",
          )}
        >
          {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-pine-900">{tier.name}</span>
          {isSuggested && !isActive && (
            <span className="text-xs text-emerald-700">Recomendado con tus datos</span>
          )}
          {isActive && <span className="text-xs text-emerald-700">Tramo contratado</span>}
        </span>
      </button>

      <span className="hidden text-xs text-graphite-500 sm:block">
        {formatEmpresaTierCriteria(tier)}
      </span>

      <div className="text-right">
        <span className="block text-sm font-semibold text-pine-900">{tier.priceLabel}</span>
        <span className="text-xs text-graphite-500">{tier.priceNote}</span>
        {canContract && !isActive && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 w-full sm:w-auto"
            onClick={onContract}
            disabled={isUpgrading}
          >
            Elegir
          </Button>
        )}
        {isActive && (
          <Badge className="mt-2 border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            Activo
          </Badge>
        )}
      </div>
    </li>
  )
}

function GestoriaTiersSection({
  isGestoria,
  activeTierId,
  selectedTierId,
  onSelectTier,
  isUpgrading,
  canUpgradeAccount,
  onContract,
}: {
  isGestoria: boolean
  activeTierId: string | null
  selectedTierId: string
  onSelectTier: (tierId: string) => void
  isUpgrading: boolean
  canUpgradeAccount: boolean
  onContract: (tierId: string) => void
}) {
  const selectedTier = getGestoriaTierById(selectedTierId)

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Briefcase className="mt-0.5 h-5 w-5 text-emerald-700" />
        <div>
          <h3 className="font-semibold text-pine-900">{ACCOUNT_TYPE_LABELS.GESTORIA}</h3>
          <p className="text-sm text-graphite-500">
            Precio escalado por cartera: +500 € cada 50 clientes adicionales.
          </p>
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {GESTORIA_PLAN_FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-graphite-600">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="overflow-hidden rounded-xl border border-sand-200">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-sand-200 bg-sand-50/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-graphite-500 sm:px-4">
          <span>Tramo de clientes</span>
          <span className="text-right">Precio / mes</span>
          <span className="hidden w-28 text-right sm:block">Acción</span>
        </div>
        <ul className="divide-y divide-sand-100">
          {GESTORIA_SUBSCRIPTION_TIERS.map((tier) => (
            <GestoriaTierRow
              key={tier.id}
              tier={tier}
              isActive={isGestoria && activeTierId === tier.id}
              isSelected={selectedTierId === tier.id}
              canContract={
                canUpgradeAccount || canUpgradeGestoriaTier(activeTierId, tier.id)
              }
              isUpgrading={isUpgrading}
              onSelect={() => onSelectTier(tier.id)}
              onContract={() => onContract(tier.id)}
            />
          ))}
        </ul>
      </div>

      {selectedTier &&
        (canUpgradeAccount ||
          (isGestoria && canUpgradeGestoriaTier(activeTierId, selectedTierId))) && (
          <Button
            type="button"
            className="w-full bg-emerald-800 hover:bg-pine-900 sm:w-auto"
            onClick={() => onContract(selectedTierId)}
            disabled={isUpgrading}
          >
            {isUpgrading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {canUpgradeAccount
              ? `Contratar Gestoría · ${selectedTier.maxClients} clientes (${selectedTier.priceLabel}/mes)`
              : `Ampliar a ${selectedTier.maxClients} clientes (${selectedTier.priceLabel}/mes)`}
          </Button>
        )}
    </div>
  )
}

function GestoriaTierRow({
  tier,
  isActive,
  isSelected,
  canContract,
  isUpgrading,
  onSelect,
  onContract,
}: {
  tier: GestoriaSubscriptionTier
  isActive: boolean
  isSelected: boolean
  canContract: boolean
  isUpgrading: boolean
  onSelect: () => void
  onContract: () => void
}) {
  return (
    <li
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-3 sm:grid-cols-[1fr_auto_auto] sm:px-4",
        isSelected && "bg-emerald-50/50",
        isActive && "bg-emerald-50/80",
      )}
    >
      <button type="button" className="flex min-w-0 items-center gap-2 text-left" onClick={onSelect}>
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
            isSelected ? "border-emerald-600 bg-emerald-600" : "border-sand-300 bg-white",
          )}
        >
          {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-pine-900">
          <Users className="h-3.5 w-3.5 text-emerald-700" />
          Hasta {tier.maxClients} clientes
        </span>
      </button>

      <span className="text-right text-sm font-semibold text-pine-900">{tier.priceLabel}</span>

      <div className="col-span-2 sm:col-span-1 sm:w-28 sm:text-right">
        {isActive ? (
          <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            Activo
          </Badge>
        ) : canContract ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onContract}
            disabled={isUpgrading}
          >
            Elegir
          </Button>
        ) : (
          <span className="text-xs text-graphite-400">—</span>
        )}
      </div>
    </li>
  )
}

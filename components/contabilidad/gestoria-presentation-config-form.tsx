"use client"

import type { AccountingPlanType } from "@prisma/client"
import { Label } from "@/components/ui/label"
import {
  ACCOUNTING_PLAN_OPTIONS,
} from "@/lib/contabilidad/gestoria-client-profile-types"
import type { GestoriaClientEntityType } from "@/lib/contabilidad/gestoria-client-service"
import {
  ACCOUNT_DETAIL_LEVEL_OPTIONS,
  BALANCE_FORMAT_OPTIONS,
  PROFIT_LOSS_FORMAT_OPTIONS,
  type GestoriaPresentationConfig,
} from "@/lib/contabilidad/gestoria-presentation-config"
import { cn } from "@/lib/utils"

interface GestoriaPresentationConfigFormProps {
  entityType: GestoriaClientEntityType
  accountingPlanType: AccountingPlanType
  presentation: GestoriaPresentationConfig
  onAccountingPlanChange: (plan: AccountingPlanType) => void
  onPresentationChange: (config: GestoriaPresentationConfig) => void
  compact?: boolean
}

function CheckboxRow({
  label,
  checked,
  onChange,
  description,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  description?: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-sand-200 px-3 py-2.5 hover:bg-sand-50/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-sand-300"
      />
      <span>
        <span className="block text-sm font-medium text-graphite-800">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-graphite-500">{description}</span>
        ) : null}
      </span>
    </label>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-sand-200 bg-sand-50/40 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-pine-900">{title}</h3>
        {description ? <p className="mt-1 text-xs text-graphite-500">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function GestoriaPresentationConfigForm({
  entityType,
  accountingPlanType,
  presentation,
  onAccountingPlanChange,
  onPresentationChange,
  compact = false,
}: GestoriaPresentationConfigFormProps) {
  const isAutonomo = entityType === "fisica"
  const update = (patch: Partial<GestoriaPresentationConfig>) => {
    onPresentationChange({ ...presentation, ...patch })
  }
  const updateAnnual = (patch: Partial<GestoriaPresentationConfig["annualAccounts"]>) => {
    onPresentationChange({
      ...presentation,
      annualAccounts: { ...presentation.annualAccounts, ...patch },
    })
  }
  const updateCorporateTax = (patch: Partial<GestoriaPresentationConfig["corporateTax"]>) => {
    onPresentationChange({
      ...presentation,
      corporateTax: { ...presentation.corporateTax, ...patch },
    })
  }
  const updateBooks = (patch: Partial<GestoriaPresentationConfig["booksLegalization"]>) => {
    onPresentationChange({
      ...presentation,
      booksLegalization: { ...presentation.booksLegalization, ...patch },
    })
  }

  const balanceOptions = isAutonomo
    ? BALANCE_FORMAT_OPTIONS.filter((item) => item.id === "IRPF_SIMPLIFICADO")
    : BALANCE_FORMAT_OPTIONS.filter((item) => item.id !== "IRPF_SIMPLIFICADO")

  const pygOptions = isAutonomo
    ? PROFIT_LOSS_FORMAT_OPTIONS.filter((item) => item.id === "IRPF")
    : PROFIT_LOSS_FORMAT_OPTIONS.filter((item) => item.id !== "IRPF")

  return (
    <div className={cn("space-y-4", compact ? "" : "space-y-5")}>
      <Section
        title="Plan contable y diseño de balances"
        description="Define el plan PGC y los formatos de balance que se usarán en libros, cuentas anuales e impuestos."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-graphite-600">Plan contable</Label>
            <select
              value={accountingPlanType}
              onChange={(event) =>
                onAccountingPlanChange(event.target.value as AccountingPlanType)
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {ACCOUNTING_PLAN_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-graphite-600">Balance de situación</Label>
            <select
              value={presentation.annualAccounts.balanceFormat}
              onChange={(event) => {
                const balanceFormat = event.target.value as GestoriaPresentationConfig["balanceFormat"]
                update({ balanceFormat })
                updateAnnual({ balanceFormat })
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {balanceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.code} · {option.label} ({option.plan})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-graphite-600">Cuenta de pérdidas y ganancias</Label>
            <select
              value={presentation.annualAccounts.profitLossFormat}
              onChange={(event) => {
                const profitLossFormat =
                  event.target.value as GestoriaPresentationConfig["profitLossFormat"]
                update({ profitLossFormat })
                updateAnnual({ profitLossFormat })
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {pygOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.code} · {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-graphite-600">Detalle de cuentas en informes</Label>
            <select
              value={presentation.annualAccounts.accountDetailLevel}
              onChange={(event) =>
                updateAnnual({
                  accountDetailLevel: event.target.value as GestoriaPresentationConfig["annualAccounts"]["accountDetailLevel"],
                })
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {ACCOUNT_DETAIL_LEVEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section
        title="Cuentas anuales"
        description="Memoria, ECPN, EFE y comparativas del ejercicio anterior."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <CheckboxRow
            label="Incluir memoria"
            checked={presentation.annualAccounts.includeMemoria}
            onChange={(checked) => updateAnnual({ includeMemoria: checked })}
          />
          <CheckboxRow
            label="Incluir ECPN"
            checked={presentation.annualAccounts.includeEcpn}
            onChange={(checked) => updateAnnual({ includeEcpn: checked })}
            description="Estado de cambios en el patrimonio neto"
          />
          <CheckboxRow
            label="Incluir EFE"
            checked={presentation.annualAccounts.includeEfe}
            onChange={(checked) => updateAnnual({ includeEfe: checked })}
            description="Estado de flujos de efectivo"
          />
          <CheckboxRow
            label="Comparativas con ejercicio anterior"
            checked={presentation.annualAccounts.comparativePreviousYear}
            onChange={(checked) => updateAnnual({ comparativePreviousYear: checked })}
          />
        </div>
      </Section>

      {!isAutonomo ? (
        <Section
          title="Impuesto sobre sociedades y pagos fraccionados"
          description="Modelo 200, pagos a cuenta (202) y depósito de cuentas anuales."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <CheckboxRow
              label="Impuesto de sociedades (Mod. 200)"
              checked={presentation.corporateTax.enabled}
              onChange={(checked) => updateCorporateTax({ enabled: checked })}
            />
            <CheckboxRow
              label="Pagos fraccionados (Mod. 202)"
              checked={presentation.corporateTax.installmentPayments}
              onChange={(checked) => updateCorporateTax({ installmentPayments: checked })}
            />
            <CheckboxRow
              label="Depósito cuentas anuales (Registro Mercantil)"
              checked={presentation.corporateTax.annualAccountsDeposit}
              onChange={(checked) => updateCorporateTax({ annualAccountsDeposit: checked })}
            />
            <CheckboxRow
              label="Modelo 232 · operaciones vinculadas"
              checked={presentation.model232Enabled}
              onChange={(checked) => update({ model232Enabled: checked })}
            />
          </div>
        </Section>
      ) : (
        <Section
          title="IRPF y obligaciones del autónomo"
          description="Persona física: estimación directa / IRPF en lugar de impuesto de sociedades."
        >
          <p className="text-sm text-graphite-600">
            Este cliente se configura con formatos IRPF. El impuesto de sociedades, el modelo 232 y
            los pagos fraccionados del IS no aplican.
          </p>
        </Section>
      )}

      <Section
        title="Legalización de libros"
        description="Libro diario, inventario y cuentas anuales con el mismo diseño de balances."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <CheckboxRow
            label="Libro diario"
            checked={presentation.booksLegalization.libroDiario}
            onChange={(checked) => updateBooks({ libroDiario: checked })}
          />
          <CheckboxRow
            label="Libro de inventario y cuentas anuales"
            checked={presentation.booksLegalization.libroInventario}
            onChange={(checked) => updateBooks({ libroInventario: checked })}
          />
          <CheckboxRow
            label="Libro único de cuentas anuales"
            checked={presentation.booksLegalization.libroCuentasAnuales}
            onChange={(checked) => updateBooks({ libroCuentasAnuales: checked })}
          />
          <CheckboxRow
            label="Portadas y certificaciones"
            checked={presentation.booksLegalization.listCoversAndCertifications}
            onChange={(checked) => updateBooks({ listCoversAndCertifications: checked })}
          />
          <CheckboxRow
            label="Con descripción de cuentas"
            checked={presentation.booksLegalization.includeAccountDescriptions}
            onChange={(checked) => updateBooks({ includeAccountDescriptions: checked })}
          />
        </div>
      </Section>
    </div>
  )
}

"use client"

import { Label } from "@/components/ui/label"
import {
  SII_MODE_OPTIONS,
  siiModeLabel,
  yesNoLabel,
  type CompanySiiMode,
  type CompanyVatCensus,
} from "@/lib/company/sii"

export function VatCensusFields({
  value,
  onChange,
  disabled = false,
}: {
  value: CompanyVatCensus
  onChange?: (next: CompanyVatCensus) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-3 rounded-xl border border-sand-200 bg-white p-3">
      <p className="text-sm font-medium text-pine-900">IVA: SII y criterio de caja</p>
      <p className="text-xs leading-relaxed text-graphite-500">
        Hacienda escribe estas respuestas en el modelo 303. El SII voluntario marca la inscripción
        voluntaria. El criterio de caja distingue si la empresa está acogida y si recibe facturas de
        proveedores acogidos. Las empresas en SII liquidan el IVA mes a mes, en los periodos 01 a 12.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-graphite-500">
            Régimen de SII
          </Label>
          {disabled ? (
            <p className="text-sm font-medium text-pine-900">{siiModeLabel(value.siiMode)}</p>
          ) : (
            <select
              value={value.siiMode}
              onChange={(event) =>
                onChange?.({ ...value, siiMode: event.target.value as CompanySiiMode })
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {SII_MODE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <CensusCheck
          label="Acogida al criterio de caja"
          checked={value.cashBasisSubject}
          disabled={disabled}
          onChange={(cashBasisSubject) => onChange?.({ ...value, cashBasisSubject })}
        />
        <CensusCheck
          label="Destinataria de criterio de caja"
          checked={value.cashBasisRecipient}
          disabled={disabled}
          onChange={(cashBasisRecipient) => onChange?.({ ...value, cashBasisRecipient })}
        />
      </div>
    </div>
  )
}

function CensusCheck({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  if (disabled) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-graphite-500">{label}</p>
        <p className="mt-1 text-sm font-medium text-pine-900">{yesNoLabel(checked)}</p>
      </div>
    )
  }

  return (
    <label className="flex items-center gap-2 text-sm text-pine-900">
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

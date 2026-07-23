"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DOCUMENT_ACCUMULATION_OPTIONS,
  IRPF_ACCOUNT_OPTIONS,
  type AccountTreatmentConfigInput,
} from "@/lib/accounting/account-treatment-types"
import { VAT_OPERATION_TYPES, VAT_RATE_TYPES, TAX_FORM_TYPES } from "@/lib/accounting/vat-catalog"

interface AccountTreatmentFieldsProps {
  value: AccountTreatmentConfigInput
  onChange: (value: AccountTreatmentConfigInput) => void
  showCounterpart?: boolean
}

export function AccountTreatmentFields({
  value,
  onChange,
  showCounterpart = true,
}: AccountTreatmentFieldsProps) {
  const patch = (partial: Partial<AccountTreatmentConfigInput>) =>
    onChange({ ...value, ...partial })

  return (
    <div className="space-y-4 rounded-lg border border-sand-200 bg-white p-4">
      <div>
        <h4 className="text-sm font-medium text-emerald-900">Tratamiento contable habitual</h4>
        <p className="text-xs text-graphite-600">
          Parametrización A3CON: contrapartida, IVA, IRPF e impreso fiscal por defecto.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {showCounterpart && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="treatment-counterpart">Contrapartida habitual</Label>
            <Input
              id="treatment-counterpart"
              value={value.defaultCounterpartAccount ?? ""}
              onChange={(event) => patch({ defaultCounterpartAccount: event.target.value })}
              placeholder="60700000 · Trabajos realizados"
              className="font-mono"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="treatment-operation">Tipo operación IVA</Label>
          <select
            id="treatment-operation"
            value={value.defaultVatOperation ?? "1"}
            onChange={(event) => patch({ defaultVatOperation: event.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {VAT_OPERATION_TYPES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} · {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="treatment-vat-type">Tipo IVA habitual</Label>
          <select
            id="treatment-vat-type"
            value={value.defaultVatType ?? "04"}
            onChange={(event) => {
              const selected = VAT_RATE_TYPES.find((item) => item.code === event.target.value)
              patch({
                defaultVatType: event.target.value,
                defaultVatPercent: selected?.vatPercent ?? value.defaultVatPercent,
                defaultSurchargePercent: selected?.surchargePercent ?? 0,
              })
            }}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {VAT_RATE_TYPES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} · {item.vatPercent}%
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="treatment-vat-percent">% IVA</Label>
          <Input
            id="treatment-vat-percent"
            type="number"
            step="0.01"
            value={value.defaultVatPercent ?? ""}
            onChange={(event) =>
              patch({ defaultVatPercent: Number.parseFloat(event.target.value) || 0 })
            }
            className="text-right font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="treatment-tax-form">Impreso fiscal</Label>
          <select
            id="treatment-tax-form"
            value={value.defaultTaxForm ?? "347"}
            onChange={(event) => patch({ defaultTaxForm: event.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {TAX_FORM_TYPES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 self-end rounded-lg border border-sand-200 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={value.applySurcharge ?? false}
            onChange={(event) => patch({ applySurcharge: event.target.checked })}
          />
          Recargo equivalencia
        </label>

        {value.applySurcharge && (
          <div className="space-y-1.5">
            <Label htmlFor="treatment-surcharge">% Recargo</Label>
            <Input
              id="treatment-surcharge"
              type="number"
              step="0.01"
              value={value.defaultSurchargePercent ?? ""}
              onChange={(event) =>
                patch({ defaultSurchargePercent: Number.parseFloat(event.target.value) || 0 })
              }
              className="text-right font-mono"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="treatment-irpf-percent">% IRPF / Retención</Label>
          <Input
            id="treatment-irpf-percent"
            type="number"
            step="0.01"
            min="0"
            value={value.defaultIrpfPercent ?? ""}
            onChange={(event) =>
              patch({
                defaultIrpfPercent: event.target.value
                  ? Number.parseFloat(event.target.value)
                  : null,
              })
            }
            className="text-right font-mono"
            placeholder="15"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="treatment-irpf-account">Cuenta retención</Label>
          <select
            id="treatment-irpf-account"
            value={value.defaultIrpfAccount ?? ""}
            onChange={(event) => patch({ defaultIrpfAccount: event.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Sin retención</option>
            {IRPF_ACCOUNT_OPTIONS.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="treatment-accumulation">Acumulados / Modelo fiscal</Label>
          <select
            id="treatment-accumulation"
            value={value.documentAccumulationType ?? "347"}
            onChange={(event) => patch({ documentAccumulationType: event.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {DOCUMENT_ACCUMULATION_OPTIONS.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

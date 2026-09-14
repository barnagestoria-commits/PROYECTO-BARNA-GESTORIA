"use client"

import {
  ACCOUNT_DETAIL_LEVEL_OPTIONS,
  type GestoriaAccountDetailLevel,
} from "@/lib/contabilidad/gestoria-presentation-config"

const DETAIL_HINT: Record<GestoriaAccountDetailLevel, string> = {
  NIVEL_3: "Vista general: 410, 621, 705. Las subcuentas se agrupan en la cuenta de 3 dígitos.",
  NIVEL_4: "Cuentas genéricas de 4 dígitos: 4100, 6212, 4751.",
  SUBCUENTAS:
    "Cada cuenta y subcuenta en su línea: 410.00001 Catcher, 430.00019 Fernández Vega, 601.00001.",
}

interface AccountDetailLevelPickerProps {
  value: GestoriaAccountDetailLevel
  onChange: (value: GestoriaAccountDetailLevel) => void
  legend?: string
}

export function AccountDetailLevelPicker({
  value,
  onChange,
  legend = "Niveles a listar",
}: AccountDetailLevelPickerProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {ACCOUNT_DETAIL_LEVEL_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={value === option.id}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              value === option.id
                ? "border-emerald-700 bg-emerald-800 text-white"
                : "border-sand-300 bg-white text-graphite-700 hover:border-emerald-400"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-graphite-500">{DETAIL_HINT[value]}</p>
    </fieldset>
  )
}

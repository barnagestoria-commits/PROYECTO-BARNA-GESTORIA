import { parseFiscalRoutePeriod } from "@/lib/fiscal/panorama"
import type { CompanySiiMode } from "@/lib/company/sii"

export interface ResolvedFiscalRoutePeriod {
  quarter: 1 | 2 | 3 | 4 | "annual"
  month?: number
}

export function resolveFiscalRoutePeriod(
  model: string,
  raw: string,
): { period: ResolvedFiscalRoutePeriod } | { error: string } {
  const parsed = parseFiscalRoutePeriod(raw)
  if (!parsed) return { error: "Periodo no válido." }
  if (parsed.kind === "month" && model !== "303") {
    return { error: "El periodo mensual solo existe en el modelo 303." }
  }
  if (parsed.kind === "month") {
    return { period: { quarter: parsed.quarter, month: parsed.month } }
  }
  return { period: { quarter: parsed.quarter } }
}

export function quarterly303BlockedForSii(
  model: string,
  period: ResolvedFiscalRoutePeriod,
  siiMode: CompanySiiMode | null | undefined,
): string | null {
  if (model !== "303" || period.month || period.quarter === "annual") return null
  if (siiMode === "OBLIGATORIO" || siiMode === "VOLUNTARIO") {
    return "Esta empresa está en el SII. El modelo 303 se descarga por meses, del 01 al 12."
  }
  return null
}

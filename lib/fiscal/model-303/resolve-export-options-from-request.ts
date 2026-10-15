import type { Model303FileOptions } from "@/lib/fiscal/aeat/tax-engine-bridge"
import { resolveDraftResultAmount } from "@/lib/fiscal/official-layouts"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import {
  parseModel303ExportPayment,
  resolveModel303FileOptions,
} from "@/lib/fiscal/model-303/export-payment"

export function resolveModel303OptionsFromRequest(
  request: Request,
  detail: FiscalModelDetailResponse,
  taxDirectDebitIban: string | null | undefined,
): { options: Model303FileOptions; error?: string } {
  const url = new URL(request.url)
  const payment = parseModel303ExportPayment(url.searchParams.get("pago303"))
  const resultAmount = resolveDraftResultAmount(detail)
  return resolveModel303FileOptions({
    payment,
    resultAmount,
    taxDirectDebitIban,
    period: { year: detail.year, quarter: detail.quarter },
  })
}

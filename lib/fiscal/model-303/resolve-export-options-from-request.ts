import type { CompanyTaxIdentity } from "@/lib/company/resolve-tax-identity"
import type { Model303FileOptions } from "@/lib/fiscal/aeat/tax-engine-bridge"
import { resolveDraftResultAmount } from "@/lib/fiscal/official-layouts"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import {
  parseModel303ExportPayment,
  resolveModel303FileOptions,
} from "@/lib/fiscal/model-303/export-payment"

export function withCompanyVatCensus(
  options: Model303FileOptions,
  company: Pick<CompanyTaxIdentity, "siiMode" | "cashBasisSubject" | "cashBasisRecipient">,
): Model303FileOptions {
  return {
    ...options,
    cashBasisSubject: company.cashBasisSubject,
    cashBasisRecipient: company.cashBasisRecipient,
    voluntarySii: company.siiMode === "VOLUNTARIO",
    siiMode: company.siiMode,
  }
}

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
    period: {
      year: detail.year,
      quarter: detail.quarter,
      month: detail.month ?? undefined,
    },
  })
}

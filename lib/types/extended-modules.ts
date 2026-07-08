import type { FiscalModelDetailResponse, FiscalPeriodKey } from "@/lib/types/fiscal-panorama"
import type { TaxSummaryBreakdown } from "@/lib/fiscal/tax-summary"

export interface FiscalResumenDetailResponse {
  year: number
  quarter: number | "annual"
  periodLabel: string
  summary: TaxSummaryBreakdown
  models: Array<{
    modelCode: string
    modelLabel: string
    amount: number
    href: string
  }>
  status: FiscalModelDetailResponse["status"]
  statusLabel: string
}

export type AmortizationPeriodization = "MENSUAL" | "TRIMESTRAL" | "ANUAL"

export interface CostCenterDistributionInput {
  costCenterId: string
  percentage: number
}

export interface FixedAssetInput {
  code: string
  name: string
  description?: string
  cuentaInmovilizado: string
  cuentaAmortAcumulada: string
  cuentaGastoAmort: string
  acquisitionDate: string
  acquisitionCost: number
  residualValue?: number
  usefulLifeMonths: number
  isActive?: boolean
  distributions?: CostCenterDistributionInput[]
}

export interface FixedAssetResponse extends FixedAssetInput {
  id: string
  companyId: string
  accumulatedAmort: number
  distributions: Array<{
    id: string
    costCenterId: string
    costCenterCode: string
    costCenterName: string
    percentage: number
  }>
}

export interface AmortizationSettingsResponse {
  periodization: AmortizationPeriodization
}

export interface AmortizationGenerateResponse {
  periodLabel: string
  totalAmount: number
  entryId: string | null
  assetsProcessed: number
  message: string
}

export interface AccountingImportResponse {
  id: string
  fileName: string
  rowsImported: number
  status: string
}

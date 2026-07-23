export interface AnalyticDistributionInput {
  costCenterId: string
  percentage: number
  amount: number
}

export interface AnalyticDistributionDto extends AnalyticDistributionInput {
  costCenterCode: string
  costCenterName: string
}

export interface CompanyAccountingSettingsDto {
  analyticAccountingEnabled: boolean
}

export function isAnalyticAccount(cuenta: string): boolean {
  const digits = cuenta.replace(/\D/g, "")
  if (!digits) return false
  const group = digits.charAt(0)
  return group === "6" || group === "7"
}

export function lineAnalyticAmount(debe: number, haber: number): number {
  return Math.max(debe, haber)
}

export function validateAnalyticDistributions(
  totalAmount: number,
  distributions: AnalyticDistributionInput[],
): string | null {
  if (distributions.length === 0) {
    return "Asigna al menos un centro de coste."
  }

  const pctSum = Math.round(distributions.reduce((sum, item) => sum + item.percentage, 0) * 100) / 100
  if (Math.abs(pctSum - 100) > 0.01) {
    return `La distribución debe sumar 100% (actual: ${pctSum.toFixed(2)}%).`
  }

  const amountSum = Math.round(distributions.reduce((sum, item) => sum + item.amount, 0) * 100) / 100
  if (Math.abs(amountSum - totalAmount) > 0.02) {
    return `Los importes deben coincidir con el apunte (${totalAmount.toFixed(2)} €).`
  }

  return null
}

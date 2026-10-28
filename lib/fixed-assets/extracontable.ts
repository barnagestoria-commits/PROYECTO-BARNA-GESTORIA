/**
 * Ajustes extracontables de amortización.
 * La variación del periodo es amortización contable menos amortización fiscal.
 * Si la contable es mayor, el exceso no es deducible: aumento de la base.
 * Si la fiscal es mayor, hay una deducción adicional: disminución.
 * El mismo importe alimenta el modelo 202 (casillas 07 y 08) y el impuesto
 * sobre sociedades del modelo 200.
 */

export type FixedAssetAdjustmentKind =
  | "NINGUNO"
  | "LIBRE_ACELERADA"
  | "ARRENDAMIENTO"
  | "LEY_16_2012"

export interface ExtracontableAsset {
  code: string
  name: string
  adjustmentKind: FixedAssetAdjustmentKind
  acquisitionDate: Date
  acquisitionCost: number
  residualValue: number
  usefulLifeMonths: number
  /** Coeficiente fiscal anual sobre la base amortizable. Vacío: la fiscal coincide con la contable. */
  fiscalAnnualPercent: number | null
}

export interface ExtracontableRow {
  code: string
  name: string
  adjustmentKind: FixedAssetAdjustmentKind
  accountingPeriod: number
  fiscalPeriod: number
  variationPeriod: number
  accountingAccumulated: number
  fiscalAccumulated: number
  variationAccumulated: number
  deferredPeriod: number
  deferredAccumulated: number
  increase: number
  decrease: number
}

export interface ExtracontableReport {
  rows: ExtracontableRow[]
  increase: number
  decrease: number
  deferredPeriod: number
  deferredAccumulated: number
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function monthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth()
}

function accumulatedAt(monthly: number, depreciable: number, acquisition: Date, through: Date): number {
  if (monthly <= 0 || depreciable <= 0) return 0
  if (monthIndex(through) < monthIndex(acquisition)) return 0
  const months = monthIndex(through) - monthIndex(acquisition) + 1
  return round2(Math.min(depreciable, monthly * months))
}

function amountBetween(
  monthly: number,
  depreciable: number,
  acquisition: Date,
  from: Date,
  through: Date,
): number {
  const atEnd = accumulatedAt(monthly, depreciable, acquisition, through)
  const dayBefore = new Date(from.getTime() - 24 * 60 * 60 * 1000)
  const before = accumulatedAt(monthly, depreciable, acquisition, dayBefore)
  return round2(Math.max(0, atEnd - before))
}

function rates(asset: ExtracontableAsset): { accountingMonthly: number; fiscalMonthly: number; depreciable: number } {
  const depreciable = round2(Math.max(0, asset.acquisitionCost - asset.residualValue))
  const life = Math.max(1, asset.usefulLifeMonths)
  const accountingMonthly = depreciable / life
  const fiscalMonthly =
    asset.fiscalAnnualPercent === null ? accountingMonthly : (depreciable * asset.fiscalAnnualPercent) / 100 / 12
  return { accountingMonthly, fiscalMonthly, depreciable }
}

export function extracontableRow(
  asset: ExtracontableAsset,
  periodStart: Date,
  periodEnd: Date,
  taxRate: number,
): ExtracontableRow {
  const { accountingMonthly, fiscalMonthly, depreciable } = rates(asset)
  const accountingPeriod = amountBetween(accountingMonthly, depreciable, asset.acquisitionDate, periodStart, periodEnd)
  const fiscalPeriod = amountBetween(fiscalMonthly, depreciable, asset.acquisitionDate, periodStart, periodEnd)
  const variationPeriod = round2(accountingPeriod - fiscalPeriod)
  const accountingAccumulated = accumulatedAt(accountingMonthly, depreciable, asset.acquisitionDate, periodEnd)
  const fiscalAccumulated = accumulatedAt(fiscalMonthly, depreciable, asset.acquisitionDate, periodEnd)
  const variationAccumulated = round2(accountingAccumulated - fiscalAccumulated)

  return {
    code: asset.code,
    name: asset.name,
    adjustmentKind: asset.adjustmentKind,
    accountingPeriod,
    fiscalPeriod,
    variationPeriod,
    accountingAccumulated,
    fiscalAccumulated,
    variationAccumulated,
    deferredPeriod: round2((variationPeriod * taxRate) / 100),
    deferredAccumulated: round2((variationAccumulated * taxRate) / 100),
    increase: round2(Math.max(0, variationPeriod)),
    decrease: round2(Math.max(0, -variationPeriod)),
  }
}

export function buildExtracontableReport(
  assets: ExtracontableAsset[],
  year: number,
  taxRate: number,
  throughMonth = 12,
): ExtracontableReport {
  const periodStart = new Date(Date.UTC(year, 0, 1))
  const periodEnd = new Date(Date.UTC(year, throughMonth, 0))
  const rows = assets
    .filter((asset) => asset.adjustmentKind !== "NINGUNO")
    .map((asset) => extracontableRow(asset, periodStart, periodEnd, taxRate))
    .filter((row) => row.accountingPeriod !== 0 || row.fiscalPeriod !== 0 || row.variationPeriod !== 0)

  return {
    rows,
    increase: round2(rows.reduce((sum, row) => sum + row.increase, 0)),
    decrease: round2(rows.reduce((sum, row) => sum + row.decrease, 0)),
    deferredPeriod: round2(rows.reduce((sum, row) => sum + row.deferredPeriod, 0)),
    deferredAccumulated: round2(rows.reduce((sum, row) => sum + row.deferredAccumulated, 0)),
  }
}

export const ADJUSTMENT_KIND_LABELS: Record<FixedAssetAdjustmentKind, string> = {
  NINGUNO: "Sin ajuste extracontable",
  LIBRE_ACELERADA: "Amortización libre y acelerada",
  ARRENDAMIENTO: "Operaciones de arrendamiento financiero",
  LEY_16_2012: "Correcciones 30 % Ley 16/2012",
}

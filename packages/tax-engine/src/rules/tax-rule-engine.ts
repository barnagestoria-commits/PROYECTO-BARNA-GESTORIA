import { roundEuro } from "../amount-format"
import type { TaxCasillaValue } from "../types"

export interface Model303CasillaInputs {
  base01: number
  cuota03: number
  base04: number
  cuota06: number
  base07: number
  cuota09: number
  base10: number
  cuota11: number
  base12: number
  cuota13: number
  base28: number
  cuota29: number
  base30: number
  cuota31: number
  base32: number
  cuota33: number
  base34: number
  cuota35: number
  base36: number
  cuota37: number
  base38: number
  cuota39: number
  cuota110?: number
}

export function finalizeModel303Casillas(values: Model303CasillaInputs): TaxCasillaValue[] {
  const cuota110 = roundEuro(values.cuota110 ?? 0)
  const cuota27 = roundEuro(
    values.cuota03 + values.cuota06 + values.cuota09 + values.cuota11 + values.cuota13,
  )
  const cuota45 = roundEuro(
    values.cuota29 + values.cuota31 + values.cuota33 + values.cuota35 + values.cuota37 + values.cuota39,
  )
  const cuota46 = roundEuro(cuota27 - cuota45)
  const cuota71 = roundEuro(cuota46 - cuota110)

  const entries: Array<[string, number]> = [
    ["01", values.base01],
    ["03", values.cuota03],
    ["04", values.base04],
    ["06", values.cuota06],
    ["07", values.base07],
    ["09", values.cuota09],
    ["10", values.base10],
    ["11", values.cuota11],
    ["12", values.base12],
    ["13", values.cuota13],
    ["27", cuota27],
    ["28", values.base28],
    ["29", values.cuota29],
    ["30", values.base30],
    ["31", values.cuota31],
    ["32", values.base32],
    ["33", values.cuota33],
    ["34", values.base34],
    ["35", values.cuota35],
    ["36", values.base36],
    ["37", values.cuota37],
    ["38", values.base38],
    ["39", values.cuota39],
    ["45", cuota45],
    ["46", cuota46],
    ["64", cuota46],
    ["66", cuota46],
    ["69", cuota46],
    ["110", cuota110],
    ["71", cuota71],
  ]

  return entries.map(([casilla, amount]) => ({ casilla, amount: roundEuro(amount) }))
}

export class TaxRuleEngine {
  buildModel303Casillas(values: Model303CasillaInputs): TaxCasillaValue[] {
    return finalizeModel303Casillas(values)
  }
}

export const defaultTaxRuleEngine = new TaxRuleEngine()

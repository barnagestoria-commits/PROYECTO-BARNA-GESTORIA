import { roundEuro } from "../amount-format"
import type { TaxCasillaValue, TaxFact, TaxFactSourceRef, TaxReturnContext, TaxReturnDraft } from "../types"

export interface TaxFactInput {
  factType: string
  casilla?: string
  amount: number
  sourceRefs?: TaxFactSourceRef[]
  metadata?: Record<string, string>
}

let factCounter = 0

function nextFactId(): string {
  factCounter += 1
  return `taxfact_${factCounter}`
}

export class TaxFactLedger {
  private readonly facts: TaxFact[] = []

  addFact(context: TaxReturnContext, companyId: string, input: TaxFactInput): TaxFact {
    const fact: TaxFact = {
      id: nextFactId(),
      companyId,
      modelCode: context.modelCode,
      year: context.year,
      period: context.period,
      factType: input.factType,
      casilla: input.casilla,
      amount: roundEuro(input.amount),
      currency: "EUR",
      sourceRefs: input.sourceRefs ?? [],
      metadata: input.metadata,
      createdAt: new Date(),
    }
    this.facts.push(fact)
    return fact
  }

  addCasillaFacts(
    context: TaxReturnContext,
    companyId: string,
    casillas: TaxCasillaValue[],
  ): TaxFact[] {
    return casillas
      .filter((casilla) => casilla.amount !== 0)
      .map((casilla) =>
        this.addFact(context, companyId, {
          factType: "casilla",
          casilla: casilla.casilla,
          amount: casilla.amount,
          sourceRefs: casilla.sources,
        }),
      )
  }

  list(): TaxFact[] {
    return [...this.facts]
  }

  buildDraft(context: TaxReturnContext, companyId: string, casillas: TaxCasillaValue[]): TaxReturnDraft {
    const facts = this.addCasillaFacts(context, companyId, casillas)
    return { context, casillas, facts }
  }
}

export function aggregateCasillasByCode(values: TaxCasillaValue[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const value of values) {
    map.set(value.casilla, roundEuro((map.get(value.casilla) ?? 0) + value.amount))
  }
  return map
}

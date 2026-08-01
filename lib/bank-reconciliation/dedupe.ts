import type { BankMovementDraft } from "@/lib/bank-reconciliation/types"

function normalizeConcept(concept: string): string {
  return concept
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80)
}

export function buildBankMovementDedupeKey(draft: BankMovementDraft): string {
  const amount = draft.amount.toFixed(2)
  const concept = normalizeConcept(draft.concept)
  const reference = (draft.reference ?? "").trim().toLowerCase().slice(0, 40)
  return `${draft.movementDate}|${amount}|${concept}|${reference}`
}

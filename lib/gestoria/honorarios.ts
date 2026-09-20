import { normalizeCif } from "@/lib/accounting/third-party-types"

export interface HonorariosCandidate {
  invoiceNumber: string | null
  accountCode: string
  cif: string
  debe: number
  haber: number
}

export function thirdPartyMatchesClientCif(thirdPartyCif: string, clientCif: string | null | undefined): boolean {
  const party = normalizeCif(thirdPartyCif)
  const client = normalizeCif(clientCif ?? "")
  return Boolean(party && client && party === client)
}

export function honorariosAmountFromClientLine(line: Pick<HonorariosCandidate, "debe" | "haber">): number {
  const debe = Number(line.debe) || 0
  const haber = Number(line.haber) || 0
  return Math.round((debe > 0 ? debe : haber) * 100) / 100
}

export function isHonorariosLineForClient(
  line: HonorariosCandidate,
  clientCif: string | null | undefined,
): boolean {
  if (!thirdPartyMatchesClientCif(line.cif, clientCif)) return false
  return line.accountCode.replace(/\D/g, "").startsWith("430")
}

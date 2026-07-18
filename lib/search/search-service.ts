import { getAccountLabel } from "@/lib/reports/pgc-labels"
import { prisma } from "@/lib/db"
import type { CommandPaletteItem } from "@/lib/search/command-palette-types"
import { THIRD_PARTY_LABEL } from "@/lib/accounting/third-party-types"

function normalize(value: string): string {
  return value.trim()
}

export async function searchThirdParties(
  companyId: string,
  query: string,
  limit = 8,
): Promise<CommandPaletteItem[]> {
  const q = normalize(query)
  if (q.length < 2) return []

  const parties = await prisma.thirdParty.findMany({
    where: {
      companyId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { cif: { contains: q, mode: "insensitive" } },
        { accountCode: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: limit,
  })

  return parties.map((party) => ({
    id: `third-party-${party.id}`,
    kind: "third-party" as const,
    title: party.name,
    subtitle: `${THIRD_PARTY_LABEL[party.type]} • ${party.cif} • ${party.accountCode}`,
    href: `/dashboard/contabilidad?cuenta=${encodeURIComponent(party.accountCode)}&tercero=${encodeURIComponent(party.name)}`,
    keywords: [party.cif, party.accountCode, party.type],
  }))
}

export async function searchAccounts(
  companyId: string,
  query: string,
  limit = 8,
): Promise<CommandPaletteItem[]> {
  const q = normalize(query)
  if (q.length < 2) return []

  const lines = await prisma.entryLine.findMany({
    where: {
      entry: { companyId },
      cuenta: { contains: q, mode: "insensitive" },
    },
    select: { cuenta: true },
    distinct: ["cuenta"],
    take: limit,
    orderBy: { cuenta: "asc" },
  })

  return lines.map((line) => {
    const label = getAccountLabel(line.cuenta)
    const isThirdPartyAccount = line.cuenta.startsWith("400") || line.cuenta.startsWith("430")
    const href = isThirdPartyAccount
      ? `/dashboard/contabilidad?cuenta=${encodeURIComponent(line.cuenta)}`
      : `/dashboard/informes/sumas-saldos?cuenta=${encodeURIComponent(line.cuenta)}`

    return {
      id: `account-${line.cuenta}`,
      kind: "account" as const,
      title: line.cuenta,
      subtitle: label !== line.cuenta ? label : "Subcuenta con movimientos",
      href,
      keywords: [label],
    }
  })
}

export async function searchCommandPalette(
  companyId: string,
  query: string,
): Promise<{ thirdParties: CommandPaletteItem[]; accounts: CommandPaletteItem[] }> {
  const [thirdParties, accounts] = await Promise.all([
    searchThirdParties(companyId, query),
    searchAccounts(companyId, query),
  ])

  const accountCodesFromParties = new Set(
    thirdParties
      .map((item) => item.subtitle?.split("•").pop()?.trim())
      .filter(Boolean),
  )

  return {
    thirdParties,
    accounts: accounts.filter((item) => !accountCodesFromParties.has(item.title)),
  }
}

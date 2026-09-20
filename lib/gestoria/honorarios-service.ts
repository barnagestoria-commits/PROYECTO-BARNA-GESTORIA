import { prisma } from "@/lib/db"
import { accountCodeLookupVariants } from "@/lib/accounting/account-code-edit"
import { honorariosAmountFromClientLine, thirdPartyMatchesClientCif } from "@/lib/gestoria/honorarios"
import type { GestoriaHonorariosInvoice } from "@/lib/gestoria/team-types"

export type { GestoriaHonorariosInvoice }

export async function listHonorariosForClient(
  accountId: string,
  clientCompanyId: string,
): Promise<GestoriaHonorariosInvoice[]> {
  const [propia, client] = await Promise.all([
    prisma.company.findFirst({
      where: { accountId, kind: "GESTORIA_PROPIA" },
      select: { id: true },
    }),
    prisma.company.findFirst({
      where: { id: clientCompanyId, accountId, kind: { not: "GESTORIA_PROPIA" } },
      select: { id: true, cif: true },
    }),
  ])

  if (!propia || !client?.cif) return []

  const clientParties = await prisma.thirdParty.findMany({
    where: {
      companyId: propia.id,
      type: "CLIENTE",
    },
    select: { cif: true, accountCode: true },
  })

  const matchingCodes = clientParties
    .filter((party) => thirdPartyMatchesClientCif(party.cif, client.cif))
    .flatMap((party) => accountCodeLookupVariants(party.accountCode))

  if (matchingCodes.length === 0) return []

  const codeSet = new Set(matchingCodes.map((code) => code.replace(/\D/g, "")))

  const entries = await prisma.accountingEntry.findMany({
    where: {
      companyId: propia.id,
      lines: {
        some: {
          cuenta: { in: matchingCodes },
        },
      },
    },
    include: {
      lines: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { fecha: "desc" },
    take: 50,
  })

  return entries.flatMap((entry) => {
    const line = entry.lines.find((item) => codeSet.has(item.cuenta.replace(/\D/g, "")))
    if (!line) return []
    return [
      {
        id: entry.id,
        fecha: entry.fecha.toISOString().slice(0, 10),
        invoiceNumber: entry.invoiceNumber,
        concepto: line.concepto || entry.invoiceNumber || "Honorarios",
        amount: honorariosAmountFromClientLine({
          debe: Number(line.debe),
          haber: Number(line.haber),
        }),
      },
    ]
  })
}

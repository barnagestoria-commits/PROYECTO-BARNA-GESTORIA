import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { accountCodeLookupVariants } from "@/lib/accounting/account-code-edit"
import { expandCanonicalSubaccountCode } from "@/lib/accounting/canonical-account-code"
import { normalizeCuenta } from "@/lib/reports/format"
import { prisma } from "@/lib/db"

export interface ReleasedAccount {
  accountCode: string
  formattedAccountCode: string
  name: string | null
  kind: "tercero" | "ledger"
  thirdPartiesDeleted: number
  ledgersDeleted: number
  hadMovements: boolean
}

async function accountHasMovements(companyId: string, digits: string): Promise<boolean> {
  const variants = accountCodeLookupVariants(digits)
  const line = await prisma.entryLine.findFirst({
    where: {
      entry: { companyId },
      OR: variants.map((cuenta) => ({ cuenta })),
    },
    select: { id: true },
  })
  return Boolean(line)
}

async function deleteConfigsForCodes(companyId: string, codes: string[]) {
  const variants = [...new Set(codes.flatMap((code) => accountCodeLookupVariants(code)))]
  if (variants.length === 0) return

  await prisma.accountTreatmentConfig.deleteMany({
    where: { companyId, accountCode: { in: variants } },
  })
  await prisma.accountAnalyticTemplate.deleteMany({
    where: { companyId, accountCode: { in: variants } },
  })
}

export async function releaseCompanyAccount(
  companyId: string,
  accountCode: string,
): Promise<ReleasedAccount> {
  const digits = expandCanonicalSubaccountCode(accountCode) || normalizeCuenta(accountCode)
  if (!digits || digits.length <= 3) {
    throw new Error("Indica la subcuenta que quieres eliminar, por ejemplo 410.0003.")
  }

  const variants = accountCodeLookupVariants(digits)
  const [thirdParty, ledger, hadMovements] = await Promise.all([
    prisma.thirdParty.findFirst({
      where: { companyId, accountCode: { in: variants } },
      select: { id: true, name: true, accountCode: true },
    }),
    prisma.ledgerSubaccount.findFirst({
      where: { companyId, accountCode: { in: variants } },
      select: { id: true, name: true, accountCode: true },
    }),
    accountHasMovements(companyId, digits),
  ])

  if (!thirdParty && !ledger) {
    throw new Error(
      `No hay ficha en ${formatAccountCodeDisplay(digits)}. Si tiene asientos, traspásalos o elimínalos para dejar la cuenta vacía.`,
    )
  }

  const codesToClean = [
    thirdParty?.accountCode,
    ledger?.accountCode,
    digits,
  ].filter((code): code is string => Boolean(code))

  await prisma.$transaction(async (tx) => {
    if (thirdParty) {
      await tx.thirdParty.delete({ where: { id: thirdParty.id } })
    }
    if (ledger) {
      await tx.ledgerSubaccount.delete({ where: { id: ledger.id } })
    }
  })

  await deleteConfigsForCodes(companyId, codesToClean)

  return {
    accountCode: digits,
    formattedAccountCode: formatAccountCodeDisplay(digits),
    name: thirdParty?.name ?? ledger?.name ?? null,
    kind: thirdParty ? "tercero" : "ledger",
    thirdPartiesDeleted: thirdParty ? 1 : 0,
    ledgersDeleted: ledger ? 1 : 0,
    hadMovements,
  }
}

export async function releaseThirdPartyContact(
  companyId: string,
  thirdPartyId: string,
): Promise<{ released: ReleasedAccount[] }> {
  const party = await prisma.thirdParty.findFirst({
    where: { id: thirdPartyId, companyId },
    select: { id: true, cif: true, name: true, accountCode: true },
  })
  if (!party) {
    throw new Error("No se encontró el contacto.")
  }

  const siblings = await prisma.thirdParty.findMany({
    where: { companyId, cif: party.cif },
    select: { id: true, name: true, accountCode: true },
  })

  const released: ReleasedAccount[] = []
  for (const sibling of siblings) {
    released.push(await releaseCompanyAccount(companyId, sibling.accountCode))
  }

  return { released }
}

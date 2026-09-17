import { formatAccountCodeStored } from "@/lib/accounting/third-party-types"
import {
  accountCodeLookupVariants,
  resolveEditedAccountCode,
  type ReassignedAccount,
} from "@/lib/accounting/account-code-edit"
import { canonicalAccountDigits, isExactPgcAccount } from "@/lib/accounting/canonical-account-code"
import { isThirdPartyAccountPrefix } from "@/lib/accounting/new-account-prefix"
import { assertTargetFichaAvailable } from "@/lib/accounting/account-occupancy"
import { prisma } from "@/lib/db"

export interface ReassignAccountInput {
  fromAccountCode: string
  toAccountCode: string
  name?: string
}

export type { ReassignedAccount }
export { resolveEditedAccountCode }

async function assertTargetAvailable(
  companyId: string,
  fromDigits: string,
  toDigits: string,
) {
  if (fromDigits === toDigits) return

  const toVariants = accountCodeLookupVariants(toDigits)

  const [thirdParty, ledger] = await Promise.all([
    prisma.thirdParty.findFirst({
      where: { companyId, accountCode: { in: toVariants } },
      select: { id: true, name: true, accountCode: true },
    }),
    prisma.ledgerSubaccount.findFirst({
      where: { companyId, accountCode: { in: toVariants } },
      select: { id: true, name: true, accountCode: true },
    }),
  ])

  assertTargetFichaAvailable(thirdParty ?? ledger, toDigits, fromDigits)
}

export async function reassignCompanyAccount(
  companyId: string,
  input: ReassignAccountInput,
): Promise<ReassignedAccount> {
  const fromDigits = canonicalAccountDigits(input.fromAccountCode)
  if (!fromDigits) {
    throw new Error("Indica la cuenta que quieres modificar.")
  }

  const toDigits = resolveEditedAccountCode(input.toAccountCode, fromDigits)
  const toFormatted = formatAccountCodeStored(toDigits)
  const trimmedName = input.name?.trim()

  await assertTargetAvailable(companyId, fromDigits, toDigits)

  const fromVariants = accountCodeLookupVariants(fromDigits)

  return prisma.$transaction(async (tx) => {
    const thirdParty = await tx.thirdParty.findFirst({
      where: { companyId, accountCode: { in: fromVariants } },
    })
    const ledger = thirdParty
      ? null
      : await tx.ledgerSubaccount.findFirst({
          where: { companyId, accountCode: { in: fromVariants } },
        })

    if (thirdParty) {
      await tx.thirdParty.update({
        where: { id: thirdParty.id },
        data: {
          accountCode: toDigits,
          ...(trimmedName ? { name: trimmedName } : {}),
        },
      })
    } else if (ledger) {
      await tx.ledgerSubaccount.update({
        where: { id: ledger.id },
        data: {
          accountCode: toDigits,
          ...(trimmedName ? { name: trimmedName } : {}),
        },
      })
    } else if (
      trimmedName &&
      isExactPgcAccount(toDigits) &&
      !isThirdPartyAccountPrefix(toDigits)
    ) {
      await tx.ledgerSubaccount.upsert({
        where: { companyId_accountCode: { companyId, accountCode: toDigits } },
        create: {
          companyId,
          parentCode: toDigits,
          accountCode: toDigits,
          name: trimmedName,
        },
        update: { name: trimmedName },
      })
    }

    const treatment = await tx.accountTreatmentConfig.findFirst({
      where: { companyId, accountCode: { in: fromVariants } },
    })
    if (treatment && fromDigits !== toDigits) {
      await tx.accountTreatmentConfig.deleteMany({
        where: {
          companyId,
          accountCode: { in: accountCodeLookupVariants(toDigits) },
          id: { not: treatment.id },
        },
      })
      await tx.accountTreatmentConfig.update({
        where: { id: treatment.id },
        data: { accountCode: toDigits },
      })
    }

    if (fromDigits !== toDigits) {
      await tx.accountAnalyticTemplate.deleteMany({
        where: { companyId, accountCode: { in: accountCodeLookupVariants(toDigits) } },
      })
      await tx.accountAnalyticTemplate.updateMany({
        where: { companyId, accountCode: { in: fromVariants } },
        data: { accountCode: toDigits },
      })
    }

    const candidateLines = await tx.entryLine.findMany({
      where: {
        entry: { companyId },
        OR: fromVariants.map((cuenta) => ({ cuenta })),
      },
      select: { id: true, cuenta: true },
    })
    const lineIds = candidateLines
      .filter((line) => canonicalAccountDigits(line.cuenta) === fromDigits)
      .map((line) => line.id)

    if (lineIds.length > 0) {
      await tx.entryLine.updateMany({
        where: { id: { in: lineIds } },
        data: { cuenta: toFormatted },
      })
    }

    const namedGenericLedger =
      !thirdParty &&
      !ledger &&
      Boolean(trimmedName) &&
      isExactPgcAccount(toDigits) &&
      !isThirdPartyAccountPrefix(toDigits)

    const name =
      trimmedName ||
      thirdParty?.name ||
      ledger?.name ||
      toFormatted

    return {
      fromAccountCode: fromDigits,
      accountCode: toDigits,
      formattedAccountCode: toFormatted,
      name,
      kind: thirdParty ? "tercero" : ledger || namedGenericLedger ? "ledger" : "movements",
      linesUpdated: lineIds.length,
    }
  })
}

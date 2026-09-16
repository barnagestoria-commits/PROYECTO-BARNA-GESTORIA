import { prisma } from "@/lib/db"
import { accountCodeLookupVariants } from "@/lib/accounting/account-code-edit"
import {
  canonicalizeStoredAccountCode,
  expandCanonicalSubaccountCode,
  needsCanonicalAccountRepair,
} from "@/lib/accounting/canonical-account-code"

export async function repairCanonicalAccountCodes(companyId: string): Promise<number> {
  const [lines, ledgers, treatments, templates] = await Promise.all([
    prisma.entryLine.findMany({
      where: { entry: { companyId } },
      select: { id: true, cuenta: true },
    }),
    prisma.ledgerSubaccount.findMany({
      where: { companyId },
      select: { id: true, accountCode: true },
    }),
    prisma.accountTreatmentConfig.findMany({
      where: { companyId },
      select: { id: true, accountCode: true, defaultCounterpartAccount: true, defaultIrpfAccount: true },
    }),
    prisma.accountAnalyticTemplate.findMany({
      where: { companyId },
      select: { id: true, accountCode: true },
    }),
  ])

  const lineGroups = new Map<string, string[]>()
  for (const line of lines) {
    if (!needsCanonicalAccountRepair(line.cuenta)) continue
    const next = canonicalizeStoredAccountCode(line.cuenta)
    const ids = lineGroups.get(next) ?? []
    ids.push(line.id)
    lineGroups.set(next, ids)
  }

  let updated = 0

  for (const [next, ids] of lineGroups) {
    const result = await prisma.entryLine.updateMany({
      where: { id: { in: ids } },
      data: { cuenta: next },
    })
    updated += result.count
  }

  for (const ledger of ledgers) {
    const nextDigits = expandCanonicalSubaccountCode(ledger.accountCode)
    if (nextDigits === ledger.accountCode) continue

    const occupant = await prisma.ledgerSubaccount.findFirst({
      where: { companyId, accountCode: nextDigits, id: { not: ledger.id } },
      select: { id: true },
    })
    if (occupant) {
      await prisma.ledgerSubaccount.delete({ where: { id: ledger.id } })
      updated += 1
      continue
    }

    await prisma.ledgerSubaccount.update({
      where: { id: ledger.id },
      data: { accountCode: nextDigits },
    })
    updated += 1
  }

  for (const treatment of treatments) {
    const nextCode = canonicalizeStoredAccountCode(treatment.accountCode)
    const nextCounterpart = treatment.defaultCounterpartAccount
      ? canonicalizeStoredAccountCode(treatment.defaultCounterpartAccount)
      : treatment.defaultCounterpartAccount
    const nextIrpf = treatment.defaultIrpfAccount
      ? canonicalizeStoredAccountCode(treatment.defaultIrpfAccount)
      : treatment.defaultIrpfAccount

    if (
      nextCode === treatment.accountCode &&
      nextCounterpart === treatment.defaultCounterpartAccount &&
      nextIrpf === treatment.defaultIrpfAccount
    ) {
      continue
    }

    const occupant =
      nextCode !== treatment.accountCode
        ? await prisma.accountTreatmentConfig.findFirst({
            where: { companyId, accountCode: { in: accountCodeLookupVariants(nextCode) }, id: { not: treatment.id } },
            select: { id: true },
          })
        : null

    if (occupant) {
      await prisma.accountTreatmentConfig.delete({ where: { id: treatment.id } })
      updated += 1
      continue
    }

    await prisma.accountTreatmentConfig.update({
      where: { id: treatment.id },
      data: {
        accountCode: nextCode,
        defaultCounterpartAccount: nextCounterpart,
        defaultIrpfAccount: nextIrpf,
      },
    })
    updated += 1
  }

  for (const template of templates) {
    const nextDigits = expandCanonicalSubaccountCode(template.accountCode)
    if (nextDigits === template.accountCode) continue

    const occupant = await prisma.accountAnalyticTemplate.findFirst({
      where: { companyId, accountCode: nextDigits, id: { not: template.id } },
      select: { id: true },
    })
    if (occupant) {
      await prisma.accountAnalyticTemplate.delete({ where: { id: template.id } })
      updated += 1
      continue
    }

    await prisma.accountAnalyticTemplate.update({
      where: { id: template.id },
      data: { accountCode: nextDigits },
    })
    updated += 1
  }

  return updated
}

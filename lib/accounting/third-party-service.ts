import type { ThirdParty, ThirdPartyType } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  buildAccountCode,
  formatAccountCodeDisplay,
  normalizeCif,
  parseSubaccountSequence,
  THIRD_PARTY_PREFIX,
  type ThirdPartyResolution,
} from "@/lib/accounting/third-party-types"

async function collectExistingSequences(companyId: string, prefix: string): Promise<number[]> {
  const [parties, entryLines] = await Promise.all([
    prisma.thirdParty.findMany({
      where: {
        companyId,
        type: prefix === "400" ? "PROVEEDOR" : "CLIENTE",
      },
      select: { accountCode: true },
    }),
    prisma.entryLine.findMany({
      where: {
        entry: { companyId },
        cuenta: { startsWith: prefix },
      },
      select: { cuenta: true },
      distinct: ["cuenta"],
    }),
  ])

  const sequences = new Set<number>()

  for (const party of parties) {
    const seq = parseSubaccountSequence(party.accountCode, prefix)
    if (seq !== null) sequences.add(seq)
  }

  for (const line of entryLines) {
    const seq = parseSubaccountSequence(line.cuenta, prefix)
    if (seq !== null) sequences.add(seq)
  }

  return Array.from(sequences)
}

export async function findNextAccountSequence(companyId: string, type: ThirdPartyType): Promise<number> {
  const prefix = THIRD_PARTY_PREFIX[type]
  const sequences = await collectExistingSequences(companyId, prefix)
  const max = sequences.length > 0 ? Math.max(...sequences) : 0
  return max + 1
}

export async function findThirdPartyByCif(
  companyId: string,
  type: ThirdPartyType,
  cif: string,
): Promise<ThirdParty | null> {
  const normalizedCif = normalizeCif(cif)
  if (!normalizedCif) return null

  return prisma.thirdParty.findUnique({
    where: {
      companyId_type_cif: {
        companyId,
        type,
        cif: normalizedCif,
      },
    },
  })
}

export async function previewThirdPartyResolution(
  companyId: string,
  type: ThirdPartyType,
  cif: string,
  name: string,
): Promise<ThirdPartyResolution> {
  const normalizedCif = normalizeCif(cif)
  if (!normalizedCif) {
    throw new Error("El NIF/CIF es obligatorio para asignar la subcuenta contable.")
  }

  const existing = await findThirdPartyByCif(companyId, type, normalizedCif)
  if (existing) {
    return {
      type,
      cif: normalizedCif,
      name: existing.name,
      accountCode: existing.accountCode,
      formattedAccountCode: formatAccountCodeDisplay(existing.accountCode),
      isNew: false,
      thirdPartyId: existing.id,
    }
  }

  const nextSequence = await findNextAccountSequence(companyId, type)
  const accountCode = buildAccountCode(THIRD_PARTY_PREFIX[type], nextSequence)

  return {
    type,
    cif: normalizedCif,
    name: name.trim(),
    accountCode,
    formattedAccountCode: formatAccountCodeDisplay(accountCode),
    isNew: true,
    thirdPartyId: null,
  }
}

export async function resolveOrCreateThirdParty(
  companyId: string,
  type: ThirdPartyType,
  cif: string,
  name: string,
): Promise<ThirdPartyResolution> {
  const normalizedCif = normalizeCif(cif)
  if (!normalizedCif) {
    throw new Error("El NIF/CIF es obligatorio para asignar la subcuenta contable.")
  }

  const trimmedName = name.trim() || normalizedCif
  const existing = await findThirdPartyByCif(companyId, type, normalizedCif)

  if (existing) {
    if (existing.name !== trimmedName) {
      await prisma.thirdParty.update({
        where: { id: existing.id },
        data: { name: trimmedName },
      })
    }

    return {
      type,
      cif: normalizedCif,
      name: trimmedName,
      accountCode: existing.accountCode,
      formattedAccountCode: formatAccountCodeDisplay(existing.accountCode),
      isNew: false,
      thirdPartyId: existing.id,
    }
  }

  const nextSequence = await findNextAccountSequence(companyId, type)
  const accountCode = buildAccountCode(THIRD_PARTY_PREFIX[type], nextSequence)

  const created = await prisma.thirdParty.create({
    data: {
      companyId,
      type,
      cif: normalizedCif,
      name: trimmedName,
      accountCode,
    },
  })

  return {
    type,
    cif: normalizedCif,
    name: trimmedName,
    accountCode: created.accountCode,
    formattedAccountCode: formatAccountCodeDisplay(created.accountCode),
    isNew: true,
    thirdPartyId: created.id,
  }
}

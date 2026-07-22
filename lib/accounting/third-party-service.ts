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
        accountCode: { startsWith: prefix },
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

export async function findNextAccountSequenceForPrefix(
  companyId: string,
  prefix: string,
): Promise<number> {
  const sequences = await collectExistingSequences(companyId, prefix)
  const max = sequences.length > 0 ? Math.max(...sequences) : 0
  return max + 1
}

export async function findNextAccountSequence(companyId: string, type: ThirdPartyType): Promise<number> {
  const prefix = THIRD_PARTY_PREFIX[type]
  return findNextAccountSequenceForPrefix(companyId, prefix)
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

function accountPrefixToType(prefix: string): ThirdPartyType {
  return prefix === "430" ? "CLIENTE" : "PROVEEDOR"
}

export async function previewThirdPartyWithPrefix(
  companyId: string,
  accountPrefix: string,
  cif: string,
  name: string,
): Promise<ThirdPartyResolution> {
  const normalizedCif = normalizeCif(cif)
  if (!normalizedCif) {
    throw new Error("El NIF/CIF es obligatorio para crear la subcuenta.")
  }

  const type = accountPrefixToType(accountPrefix)
  const existing = await findThirdPartyByCif(companyId, type, normalizedCif)

  if (existing) {
    if (!existing.accountCode.startsWith(accountPrefix)) {
      throw new Error(
        `Este NIF ya está registrado con la cuenta ${formatAccountCodeDisplay(existing.accountCode)}.`,
      )
    }

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

  const nextSequence = await findNextAccountSequenceForPrefix(companyId, accountPrefix)
  const accountCode = buildAccountCode(accountPrefix, nextSequence)

  return {
    type,
    cif: normalizedCif,
    name: name.trim() || normalizedCif,
    accountCode,
    formattedAccountCode: formatAccountCodeDisplay(accountCode),
    isNew: true,
    thirdPartyId: null,
  }
}

export async function resolveOrCreateThirdPartyWithPrefix(
  companyId: string,
  accountPrefix: string,
  cif: string,
  name: string,
): Promise<ThirdPartyResolution> {
  const preview = await previewThirdPartyWithPrefix(companyId, accountPrefix, cif, name)

  if (!preview.isNew && preview.thirdPartyId) {
    if (preview.name !== name.trim() && name.trim()) {
      await prisma.thirdParty.update({
        where: { id: preview.thirdPartyId },
        data: { name: name.trim() },
      })
      return { ...preview, name: name.trim() }
    }
    return preview
  }

  const created = await prisma.thirdParty.create({
    data: {
      companyId,
      type: preview.type,
      cif: preview.cif,
      name: preview.name,
      accountCode: preview.accountCode,
    },
  })

  return {
    ...preview,
    thirdPartyId: created.id,
  }
}

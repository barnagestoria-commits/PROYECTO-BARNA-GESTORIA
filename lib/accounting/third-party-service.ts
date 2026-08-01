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

export interface BulkThirdPartyInput {
  cif: string
  name: string
  type: ThirdPartyType
}

/**
 * Resuelve o crea muchos terceros con un número fijo de consultas.
 * Pensado para importaciones masivas, donde resolveOrCreateThirdParty
 * uno a uno satura la latencia de red contra la base de datos.
 */
export async function bulkResolveOrCreateThirdParties(
  companyId: string,
  parties: BulkThirdPartyInput[],
): Promise<{ accountByCif: Map<string, string>; created: number }> {
  const accountByCif = new Map<string, string>()

  const normalized = new Map<string, BulkThirdPartyInput>()
  for (const party of parties) {
    const cif = normalizeCif(party.cif)
    if (!cif) continue
    const key = `${party.type}:${cif}`
    if (normalized.has(key)) continue
    normalized.set(key, { type: party.type, cif, name: party.name.trim() || cif })
  }

  if (normalized.size === 0) return { accountByCif, created: 0 }

  const existing = await prisma.thirdParty.findMany({
    where: { companyId },
    select: { type: true, cif: true, accountCode: true },
  })

  const existingByKey = new Map(existing.map((row) => [`${row.type}:${row.cif}`, row.accountCode]))
  const usedAccountCodes = new Set(existing.map((row) => row.accountCode))
  const pending: BulkThirdPartyInput[] = []

  for (const [key, party] of normalized) {
    const accountCode = existingByKey.get(key)
    if (accountCode) {
      accountByCif.set(party.cif, accountCode)
    } else {
      pending.push(party)
    }
  }

  if (pending.length === 0) return { accountByCif, created: 0 }

  const nextSequenceByPrefix = new Map<string, number>()
  for (const prefix of new Set(pending.map((party) => THIRD_PARTY_PREFIX[party.type]))) {
    nextSequenceByPrefix.set(prefix, await findNextAccountSequenceForPrefix(companyId, prefix))
  }

  const rows = pending.map((party) => {
    const prefix = THIRD_PARTY_PREFIX[party.type]
    let sequence = nextSequenceByPrefix.get(prefix) ?? 1
    let accountCode = buildAccountCode(prefix, sequence)

    while (usedAccountCodes.has(accountCode)) {
      sequence += 1
      accountCode = buildAccountCode(prefix, sequence)
    }

    usedAccountCodes.add(accountCode)
    nextSequenceByPrefix.set(prefix, sequence + 1)
    accountByCif.set(party.cif, accountCode)

    return {
      companyId,
      type: party.type,
      cif: party.cif,
      name: party.name,
      accountCode,
    }
  })

  const result = await prisma.thirdParty.createMany({ data: rows, skipDuplicates: true })

  return { accountByCif, created: result.count }
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

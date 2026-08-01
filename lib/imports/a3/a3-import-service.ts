import { normalizeCif } from "@/lib/accounting/third-party-types"
import {
  checkAccountExists,
  countMissingImportSubaccounts,
} from "@/lib/accounting/account-exists-service"
import { getNextEntryRefNumber } from "@/lib/accounting/entry-ref-service"
import { createLedgerSubaccountWithFixedCode } from "@/lib/accounting/ledger-subaccount-service"
import { findThirdPartyByCif, resolveOrCreateThirdParty } from "@/lib/accounting/third-party-service"
import { encodeImportFormatLabel } from "@/lib/imports/accounting-formats"
import { parseA3ZipBuffer, parseA3ZipBytes } from "@/lib/imports/a3/parse-a3-zip"
import type { A3VendorRef } from "@/lib/imports/a3/a3-client-import"
import type { A3ImportPreview, A3ImportResult, A3JournalEntry, A3Subaccount, A3ThirdParty } from "@/lib/imports/a3/types"
import { resolveVendorAccountCodes } from "@/lib/imports/a3/vendor-matching"
import { prisma } from "@/lib/db"

function uniqueVendorCifs(entries: A3JournalEntry[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.vendorCif) {
        map.set(line.vendorCif, line.vendorName ?? line.vendorCif)
      }
    }
  }
  return map
}

function thirdPartiesFromSubaccounts(subaccounts: A3Subaccount[]): A3ThirdParty[] {
  const parties: A3ThirdParty[] = []
  const seen = new Set<string>()

  for (const sub of subaccounts) {
    if (!sub.nif) continue
    const cif = normalizeCif(sub.nif)
    if (!cif || seen.has(cif)) continue
    seen.add(cif)

    const digits = sub.accountCode.replace(/\D/g, "")
    parties.push({
      cif,
      name: sub.name,
      type: digits.startsWith("430") ? "CLIENTE" : "PROVEEDOR",
      accountCode: digits.startsWith("400") || digits.startsWith("430") ? digits : undefined,
    })
  }

  return parties
}

async function countMissingSubaccounts(companyId: string, subaccounts: A3Subaccount[]): Promise<number> {
  return countMissingImportSubaccounts(
    companyId,
    subaccounts.filter((sub) => !sub.nif).map((sub) => sub.accountCode),
  )
}

async function countMissingThirdPartiesFromRefs(
  companyId: string,
  thirdParties: A3ThirdParty[],
  vendorRefs: A3VendorRef[],
): Promise<number> {
  const merged = new Map<string, A3ThirdParty>()

  for (const party of thirdParties) {
    merged.set(`${party.type}:${party.cif}`, party)
  }
  for (const ref of vendorRefs) {
    const key = `PROVEEDOR:${ref.cif}`
    if (!merged.has(key)) {
      merged.set(key, { cif: ref.cif, name: ref.name, type: "PROVEEDOR" })
    }
  }

  const parties = [...merged.values()]
  if (parties.length === 0) return 0

  const existing = await prisma.thirdParty.findMany({
    where: {
      companyId,
      OR: parties.map((party) => ({
        type: party.type,
        cif: party.cif,
      })),
    },
    select: { cif: true, type: true },
  })

  const existingKeys = new Set(existing.map((row) => `${row.type}:${row.cif}`))
  return parties.filter((party) => !existingKeys.has(`${party.type}:${party.cif}`)).length
}

async function countMissingThirdParties(
  companyId: string,
  thirdParties: A3ThirdParty[],
  entries: A3JournalEntry[],
): Promise<number> {
  const fromLines = uniqueVendorCifs(entries)
  const merged = new Map<string, A3ThirdParty>()

  for (const party of thirdParties) {
    merged.set(`${party.type}:${party.cif}`, party)
  }
  for (const [cif, name] of fromLines) {
    const key = `PROVEEDOR:${cif}`
    if (!merged.has(key)) {
      merged.set(key, { cif, name, type: "PROVEEDOR" })
    }
  }

  const parties = [...merged.values()]
  if (parties.length === 0) return 0

  const existing = await prisma.thirdParty.findMany({
    where: {
      companyId,
      OR: parties.map((party) => ({
        type: party.type,
        cif: party.cif,
      })),
    },
    select: { cif: true, type: true },
  })

  const existingKeys = new Set(existing.map((row) => `${row.type}:${row.cif}`))
  return parties.filter((party) => !existingKeys.has(`${party.type}:${party.cif}`)).length
}

async function enrichPreview(parsed: Omit<A3ImportPreview, "newSubaccountCount" | "newThirdPartyCount">) {
  const suenlaceParties = thirdPartiesFromSubaccounts(parsed.subaccounts)
  const thirdPartyMap = new Map<string, A3ThirdParty>()
  for (const party of [...parsed.thirdParties, ...suenlaceParties]) {
    thirdPartyMap.set(party.cif, party)
  }
  const thirdParties = [...thirdPartyMap.values()]

  return {
    ...parsed,
    thirdParties,
    thirdPartyCount: thirdParties.length,
  }
}

export async function previewA3ZipImport(
  companyId: string,
  fileName: string,
  buffer: Buffer,
): Promise<A3ImportPreview> {
  const parsed = await enrichPreview(await parseA3ZipBuffer(buffer, fileName))
  const [newSubaccountCount, newThirdPartyCount] = await Promise.all([
    countMissingSubaccounts(companyId, parsed.subaccounts),
    countMissingThirdParties(companyId, parsed.thirdParties, parsed.entries),
  ])

  return {
    ...parsed,
    newSubaccountCount,
    newThirdPartyCount,
  }
}

async function ensureThirdPartiesFromRefs(
  companyId: string,
  thirdParties: A3ThirdParty[],
  vendorRefs: A3VendorRef[],
): Promise<{ accountByCif: Map<string, string>; created: number }> {
  const accountByCif = new Map<string, string>()
  let created = 0

  const merged = new Map<string, A3ThirdParty>()
  for (const party of thirdParties) merged.set(party.cif, party)
  for (const ref of vendorRefs) {
    if (!merged.has(ref.cif)) merged.set(ref.cif, { cif: ref.cif, name: ref.name, type: "PROVEEDOR" })
  }

  for (const party of merged.values()) {
    if (party.accountCode?.startsWith("400") || party.accountCode?.startsWith("430")) {
      const existing = await findThirdPartyByCif(companyId, party.type, party.cif)
      if (existing) {
        accountByCif.set(party.cif, existing.accountCode)
        continue
      }
    }

    const resolved = await resolveOrCreateThirdParty(companyId, party.type, party.cif, party.name)
    accountByCif.set(party.cif, resolved.accountCode)
    if (resolved.isNew) created += 1
  }

  return { accountByCif, created }
}

async function ensureThirdParties(
  companyId: string,
  thirdParties: A3ThirdParty[],
  entries: A3JournalEntry[],
): Promise<{ accountByCif: Map<string, string>; created: number }> {
  const accountByCif = new Map<string, string>()
  let created = 0

  const fromLines = uniqueVendorCifs(entries)
  const merged = new Map<string, A3ThirdParty>()
  for (const party of thirdParties) merged.set(party.cif, party)
  for (const [cif, name] of fromLines) {
    if (!merged.has(cif)) merged.set(cif, { cif, name, type: "PROVEEDOR" })
  }

  for (const party of merged.values()) {
    if (party.accountCode?.startsWith("400") || party.accountCode?.startsWith("430")) {
      const existing = await findThirdPartyByCif(companyId, party.type, party.cif)
      if (existing) {
        accountByCif.set(party.cif, existing.accountCode)
        continue
      }
    }

    const resolved = await resolveOrCreateThirdParty(companyId, party.type, party.cif, party.name)
    accountByCif.set(party.cif, resolved.accountCode)
    if (resolved.isNew) created += 1
  }

  return { accountByCif, created }
}

export async function confirmA3ZipImport(
  companyId: string,
  fileName: string,
  buffer: Buffer,
  uploadedById?: string,
): Promise<A3ImportResult> {
  const parsed = await enrichPreview(await parseA3ZipBuffer(buffer, fileName))

  const importRecord = await prisma.accountingDataImport.create({
    data: {
      companyId,
      fileName,
      format: encodeImportFormatLabel("wk-asesor", "zip"),
      status: "PENDIENTE",
      uploadedById,
    },
  })

  try {
    let subaccountsCreated = 0

    for (const subaccount of parsed.subaccounts) {
      if (subaccount.nif) continue
      const check = await checkAccountExists(companyId, subaccount.accountCode)
      if (check.exists || !check.canQuickCreate) continue

      try {
        const result = await createLedgerSubaccountWithFixedCode(
          companyId,
          subaccount.accountCode,
          subaccount.name,
        )
        if (result.isNew) subaccountsCreated += 1
      } catch {
        // Cuenta PGC estándar: se omite.
      }
    }

    const { accountByCif, created: thirdPartiesCreated } = await ensureThirdParties(
      companyId,
      parsed.thirdParties,
      parsed.entries,
    )

    const entries = resolveVendorAccountCodes(parsed.entries, accountByCif)

    let entriesCreated = 0
    let linesImported = 0

    for (const entry of entries) {
      const date = new Date(`${entry.fecha}T00:00:00.000Z`)
      if (Number.isNaN(date.getTime())) continue

      const refNumber = await getNextEntryRefNumber(companyId)

      await prisma.accountingEntry.create({
        data: {
          companyId,
          refNumber,
          fecha: date,
          commandCode: entry.documento.trim() || null,
          createdById: uploadedById,
          lines: {
            create: entry.lines.map((line, index) => ({
              sortOrder: index,
              cuenta: line.cuenta,
              concepto: line.concepto || entry.concepto,
              debe: line.debe,
              haber: line.haber,
            })),
          },
        },
      })

      entriesCreated += 1
      linesImported += entry.lines.length
    }

    await prisma.accountingDataImport.update({
      where: { id: importRecord.id },
      data: {
        status: "PROCESADO",
        rowsImported: linesImported,
      },
    })

    return {
      id: importRecord.id,
      fileName,
      entriesCreated,
      subaccountsCreated,
      thirdPartiesCreated,
      linesImported,
      status: "PROCESADO",
    }
  } catch (error) {
    await prisma.accountingDataImport.update({
      where: { id: importRecord.id },
      data: {
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Error al importar el ZIP.",
      },
    })
    throw error
  }
}

export type A3ParsedImportMeta = Omit<A3ImportPreview, "newSubaccountCount" | "newThirdPartyCount" | "entries">

export async function previewCountsForParsedA3(
  companyId: string,
  subaccounts: A3Subaccount[],
  thirdParties: A3ThirdParty[],
  vendorRefs: A3VendorRef[],
): Promise<{ newSubaccountCount: number; newThirdPartyCount: number }> {
  const suenlaceParties = thirdPartiesFromSubaccounts(subaccounts)
  const thirdPartyMap = new Map<string, A3ThirdParty>()
  for (const party of [...thirdParties, ...suenlaceParties]) {
    thirdPartyMap.set(party.cif, party)
  }

  const [newSubaccountCount, newThirdPartyCount] = await Promise.all([
    countMissingSubaccounts(companyId, subaccounts),
    countMissingThirdPartiesFromRefs(companyId, [...thirdPartyMap.values()], vendorRefs),
  ])

  return { newSubaccountCount, newThirdPartyCount }
}

async function createSubaccountsFromParsed(
  companyId: string,
  subaccounts: A3Subaccount[],
): Promise<number> {
  let subaccountsCreated = 0

  for (const subaccount of subaccounts) {
    if (subaccount.nif) continue
    const check = await checkAccountExists(companyId, subaccount.accountCode)
    if (check.exists || !check.canQuickCreate) continue

    try {
      const result = await createLedgerSubaccountWithFixedCode(
        companyId,
        subaccount.accountCode,
        subaccount.name,
      )
      if (result.isNew) subaccountsCreated += 1
    } catch {
      // Cuenta PGC estándar: se omite.
    }
  }

  return subaccountsCreated
}

export async function startParsedA3Import(
  companyId: string,
  fileName: string,
  meta: A3ParsedImportMeta,
  vendorRefs: A3VendorRef[],
  uploadedById?: string,
): Promise<{
  importId: string
  subaccountsCreated: number
  thirdPartiesCreated: number
}> {
  const enriched = await enrichPreview({
    ...meta,
    entries: [],
  })

  const importRecord = await prisma.accountingDataImport.create({
    data: {
      companyId,
      fileName,
      format: encodeImportFormatLabel("wk-asesor", "zip"),
      status: "PENDIENTE",
      uploadedById,
    },
  })

  try {
    const subaccountsCreated = await createSubaccountsFromParsed(companyId, enriched.subaccounts)
    const { created: thirdPartiesCreated } = await ensureThirdPartiesFromRefs(
      companyId,
      enriched.thirdParties,
      vendorRefs,
    )

    return {
      importId: importRecord.id,
      subaccountsCreated,
      thirdPartiesCreated,
    }
  } catch (error) {
    await prisma.accountingDataImport.update({
      where: { id: importRecord.id },
      data: {
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Error al iniciar la importación.",
      },
    })
    throw error
  }
}

async function buildAccountByCifForEntries(
  companyId: string,
  entries: A3JournalEntry[],
): Promise<Map<string, string>> {
  const accountByCif = new Map<string, string>()
  const cifs = new Set<string>()

  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.vendorCif) cifs.add(line.vendorCif)
    }
  }

  for (const cif of cifs) {
    const existing =
      (await findThirdPartyByCif(companyId, "PROVEEDOR", cif)) ??
      (await findThirdPartyByCif(companyId, "CLIENTE", cif))
    if (existing) accountByCif.set(cif, existing.accountCode)
  }

  return accountByCif
}

export async function importParsedA3EntryBatch(
  companyId: string,
  importId: string,
  entries: A3JournalEntry[],
  uploadedById?: string,
): Promise<{ entriesCreated: number; linesImported: number }> {
  const importRecord = await prisma.accountingDataImport.findFirst({
    where: { id: importId, companyId, status: "PENDIENTE" },
  })

  if (!importRecord) {
    throw new Error("Importación no encontrada o ya finalizada.")
  }

  const accountByCif = await buildAccountByCifForEntries(companyId, entries)
  const resolvedEntries = resolveVendorAccountCodes(entries, accountByCif)

  let entriesCreated = 0
  let linesImported = 0

  for (const entry of resolvedEntries) {
    const date = new Date(`${entry.fecha}T00:00:00.000Z`)
    if (Number.isNaN(date.getTime())) continue

    const refNumber = await getNextEntryRefNumber(companyId)

    await prisma.accountingEntry.create({
      data: {
        companyId,
        refNumber,
        fecha: date,
        commandCode: entry.documento.trim() || null,
        createdById: uploadedById,
        lines: {
          create: entry.lines.map((line, index) => ({
            sortOrder: index,
            cuenta: line.cuenta,
            concepto: line.concepto || entry.concepto,
            debe: line.debe,
            haber: line.haber,
          })),
        },
      },
    })

    entriesCreated += 1
    linesImported += entry.lines.length
  }

  if (linesImported > 0) {
    await prisma.accountingDataImport.update({
      where: { id: importId },
      data: {
        rowsImported: { increment: linesImported },
      },
    })
  }

  return { entriesCreated, linesImported }
}

export async function finishParsedA3Import(
  companyId: string,
  importId: string,
  totals: {
    entriesCreated: number
    subaccountsCreated: number
    thirdPartiesCreated: number
    linesImported: number
  },
): Promise<A3ImportResult> {
  const importRecord = await prisma.accountingDataImport.findFirst({
    where: { id: importId, companyId },
  })

  if (!importRecord) {
    throw new Error("Importación no encontrada.")
  }

  await prisma.accountingDataImport.update({
    where: { id: importId },
    data: {
      status: "PROCESADO",
      rowsImported: totals.linesImported,
    },
  })

  return {
    id: importId,
    fileName: importRecord.fileName,
    entriesCreated: totals.entriesCreated,
    subaccountsCreated: totals.subaccountsCreated,
    thirdPartiesCreated: totals.thirdPartiesCreated,
    linesImported: totals.linesImported,
    status: "PROCESADO",
  }
}

export async function previewParsedA3Import(
  companyId: string,
  fileName: string,
  data: ArrayBuffer | Uint8Array | Buffer,
  vendorRefs: A3VendorRef[],
): Promise<A3ImportPreview> {
  const parsed = await enrichPreview(await parseA3ZipBytes(data, fileName))
  const counts = await previewCountsForParsedA3(
    companyId,
    parsed.subaccounts,
    parsed.thirdParties,
    vendorRefs,
  )

  return {
    ...parsed,
    ...counts,
  }
}

import { normalizeCif } from "@/lib/accounting/third-party-types"
import { checkAccountExists } from "@/lib/accounting/account-exists-service"
import { getNextEntryRefNumber } from "@/lib/accounting/entry-ref-service"
import { createLedgerSubaccountWithFixedCode } from "@/lib/accounting/ledger-subaccount-service"
import { findThirdPartyByCif, resolveOrCreateThirdParty } from "@/lib/accounting/third-party-service"
import { encodeImportFormatLabel } from "@/lib/imports/accounting-formats"
import { parseA3ZipBuffer } from "@/lib/imports/a3/parse-a3-zip"
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
  let missing = 0
  for (const subaccount of subaccounts) {
    const check = await checkAccountExists(companyId, subaccount.accountCode)
    if (!check.exists && check.canQuickCreate) missing += 1
  }
  return missing
}

async function countMissingThirdParties(
  companyId: string,
  thirdParties: A3ThirdParty[],
  entries: A3JournalEntry[],
): Promise<number> {
  const fromLines = uniqueVendorCifs(entries)
  const merged = new Map<string, A3ThirdParty>()

  for (const party of thirdParties) {
    merged.set(party.cif, party)
  }
  for (const [cif, name] of fromLines) {
    if (!merged.has(cif)) {
      merged.set(cif, { cif, name, type: "PROVEEDOR" })
    }
  }

  let missing = 0
  for (const party of merged.values()) {
    const existing = await findThirdPartyByCif(companyId, party.type, party.cif)
    if (!existing) missing += 1
  }
  return missing
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

import { prisma } from "@/lib/db"
import {
  createGestoriaClientCompany,
  type GestoriaClientEntityType,
} from "@/lib/contabilidad/gestoria-client-service"
import { confirmA3ZipImport } from "@/lib/imports/a3/a3-import-service"
import { parseA3ZipBuffer } from "@/lib/imports/a3/parse-a3-zip"
import {
  buildFolderZipBuffer,
  extractZipFolderMap,
  folderHasAccountingData,
} from "@/lib/imports/portfolio/folder-zip-utils"
import { parsePortfolioFile } from "@/lib/imports/portfolio/parse-portfolio-file"
import type {
  PortfolioCandidatePreview,
  PortfolioCompanyCandidate,
  PortfolioCompanyAccountingResult,
  PortfolioImportPreview,
  PortfolioImportResult,
} from "@/lib/imports/portfolio/types"

async function loadExistingCompanies(accountId: string, userId: string) {
  const restrictedAccessCount = await prisma.userCompanyAccess.count({
    where: { userId },
  })

  return prisma.company.findMany({
    where: {
      accountId,
      gestoriaProfile: { isNot: null },
      ...(restrictedAccessCount > 0 ? { userAccess: { some: { userId } } } : {}),
    },
    include: { gestoriaProfile: true },
  })
}

function matchCandidateStatus(
  candidate: PortfolioCompanyCandidate,
  existing: Awaited<ReturnType<typeof loadExistingCompanies>>,
): PortfolioCandidatePreview {
  if (candidate.cif) {
    const byCif = existing.find((company) => company.cif?.toUpperCase() === candidate.cif!.toUpperCase())
    if (byCif) {
      return {
        ...candidate,
        status: "exists",
        existingCompanyId: byCif.id,
        existingCompanyName: byCif.name,
      }
    }
  }

  const byCode = existing.find(
    (company) => company.gestoriaProfile?.clientCode === candidate.clientCode.padStart(5, "0"),
  )
  if (byCode) {
    return {
      ...candidate,
      status: "exists",
      existingCompanyId: byCode.id,
      existingCompanyName: byCode.name,
    }
  }

  const byName = existing.find(
    (company) => company.name.trim().toLowerCase() === candidate.name.trim().toLowerCase(),
  )
  if (byName) {
    return {
      ...candidate,
      status: "exists",
      existingCompanyId: byName.id,
      existingCompanyName: byName.name,
    }
  }

  if (!candidate.name.trim()) {
    return {
      ...candidate,
      status: "skipped",
      skipReason: "Nombre vacío",
    }
  }

  return { ...candidate, status: "new" }
}

function resolveFolderKey(
  candidate: PortfolioCompanyCandidate,
  folderMap: Map<string, Map<string, Buffer>>,
): string | null {
  if (candidate.folderPath && folderMap.has(candidate.folderPath)) {
    return candidate.folderPath
  }

  const normalizedCode = candidate.clientCode.replace(/^0+/, "")
  for (const folder of folderMap.keys()) {
    if (folder === "_root_") continue
    const folderDigits = folder.replace(/^E/i, "").replace(/^0+/, "")
    if (folderDigits === normalizedCode || folder.toUpperCase() === `E${candidate.clientCode}`.toUpperCase()) {
      return folder
    }
  }

  if (folderMap.has("_root_") && candidate.source === "a3-folder") {
    return "_root_"
  }

  return null
}

async function enrichWithAccountingPreview(
  candidates: PortfolioCandidatePreview[],
  buffer: Buffer,
  sourceType: PortfolioImportPreview["sourceType"],
): Promise<PortfolioCandidatePreview[]> {
  if (sourceType !== "multi-zip") return candidates

  const folderMap = await extractZipFolderMap(buffer)

  return Promise.all(
    candidates.map(async (candidate) => {
      if (candidate.source !== "a3-folder") return candidate

      const folderKey = resolveFolderKey(candidate, folderMap)
      if (!folderKey) return { ...candidate, hasAccountingData: false, entryCount: null }

      const files = folderMap.get(folderKey)!
      if (!folderHasAccountingData(files)) {
        return { ...candidate, hasAccountingData: false, entryCount: 0 }
      }

      try {
        const zipBuffer = await buildFolderZipBuffer(
          folderKey === "_root_" ? "E00000" : folderKey,
          files,
        )
        const parsed = await parseA3ZipBuffer(
          zipBuffer,
          `${folderKey === "_root_" ? "E00000" : folderKey}.zip`,
        )
        return {
          ...candidate,
          folderPath: folderKey === "_root_" ? "E00000" : folderKey,
          hasAccountingData: parsed.entryCount > 0 || parsed.subaccountCount > 0,
          entryCount: parsed.entryCount,
        }
      } catch {
        return { ...candidate, hasAccountingData: false, entryCount: null }
      }
    }),
  )
}

async function importAccountingForCandidate(
  companyId: string,
  candidate: PortfolioCandidatePreview,
  folderMap: Map<string, Map<string, Buffer>>,
  uploadedById: string,
): Promise<PortfolioCompanyAccountingResult> {
  const folderKey = resolveFolderKey(candidate, folderMap)
  if (!folderKey) {
    return { entriesCreated: 0, linesImported: 0, subaccountsCreated: 0, thirdPartiesCreated: 0 }
  }

  const files = folderMap.get(folderKey)!
  if (!folderHasAccountingData(files)) {
    return { entriesCreated: 0, linesImported: 0, subaccountsCreated: 0, thirdPartiesCreated: 0 }
  }

  const folderLabel = folderKey === "_root_" ? "E00000" : folderKey

  try {
    const zipBuffer = await buildFolderZipBuffer(folderLabel, files)
    const result = await confirmA3ZipImport(
      companyId,
      `${folderLabel}-cartera.zip`,
      zipBuffer,
      uploadedById,
    )

    return {
      entriesCreated: result.entriesCreated,
      linesImported: result.linesImported,
      subaccountsCreated: result.subaccountsCreated,
      thirdPartiesCreated: result.thirdPartiesCreated,
    }
  } catch (error) {
    return {
      entriesCreated: 0,
      linesImported: 0,
      subaccountsCreated: 0,
      thirdPartiesCreated: 0,
      error: error instanceof Error ? error.message : "Error al importar la contabilidad.",
    }
  }
}

export async function previewPortfolioImport(
  accountId: string,
  userId: string,
  fileName: string,
  buffer: Buffer,
): Promise<PortfolioImportPreview> {
  const { candidates, sourceType, warnings } = await parsePortfolioFile(buffer, fileName)
  const existing = await loadExistingCompanies(accountId, userId)

  const matched = candidates.map((candidate) => matchCandidateStatus(candidate, existing))
  const previewCandidates = await enrichWithAccountingPreview(matched, buffer, sourceType)

  const newCandidates = previewCandidates.filter((item) => item.status === "new")
  const newWithAccounting = newCandidates.filter(
    (item) => item.hasAccountingData && (item.entryCount ?? 0) > 0,
  )

  const accountingWarnings = [...warnings]
  if (newWithAccounting.length > 0) {
    accountingWarnings.push(
      `Se importará la contabilidad automáticamente en ${newWithAccounting.length} empresa(s) nueva(s) con asientos detectados.`,
    )
  }

  return {
    fileName,
    sourceType,
    candidates: previewCandidates,
    warnings: accountingWarnings,
    newCount: newCandidates.length,
    existingCount: previewCandidates.filter((item) => item.status === "exists").length,
    skippedCount: previewCandidates.filter((item) => item.status === "skipped").length,
    accountingEntryCount: newWithAccounting.reduce((sum, item) => sum + (item.entryCount ?? 0), 0),
    newWithAccountingCount: newWithAccounting.length,
  }
}

export async function confirmPortfolioImport(
  accountId: string,
  userId: string,
  fileName: string,
  buffer: Buffer,
): Promise<PortfolioImportResult> {
  const preview = await previewPortfolioImport(accountId, userId, fileName, buffer)
  const folderMap =
    preview.sourceType === "multi-zip" ? await extractZipFolderMap(buffer) : new Map()

  const createdCompanies: PortfolioImportResult["companies"] = []
  let accountingImported = 0
  let accountingFailed = 0
  let totalEntriesCreated = 0

  for (const candidate of preview.candidates) {
    if (candidate.status !== "new") continue

    const entityType: GestoriaClientEntityType =
      candidate.entityType === "fisica" ? "fisica" : "juridica"

    const company = await createGestoriaClientCompany(accountId, userId, {
      name: candidate.name,
      cif: candidate.cif ?? undefined,
      entityType,
    })

    if (candidate.clientCode) {
      await prisma.companyGestoriaProfile.updateMany({
        where: { companyId: company.id },
        data: { clientCode: candidate.clientCode.padStart(5, "0").slice(-7) },
      })
    }

    let accounting: PortfolioCompanyAccountingResult | undefined

    if (
      preview.sourceType === "multi-zip" &&
      candidate.source === "a3-folder" &&
      candidate.hasAccountingData
    ) {
      accounting = await importAccountingForCandidate(company.id, candidate, folderMap, userId)

      if (accounting.error) {
        accountingFailed += 1
      } else if (accounting.entriesCreated > 0) {
        accountingImported += 1
        totalEntriesCreated += accounting.entriesCreated
      }
    }

    createdCompanies.push({
      id: company.id,
      name: company.name,
      cif: company.cif,
      clientCode: candidate.clientCode,
      accounting,
    })
  }

  return {
    fileName,
    created: createdCompanies.length,
    skipped: preview.skippedCount,
    alreadyExists: preview.existingCount,
    accountingImported,
    accountingFailed,
    totalEntriesCreated,
    companies: createdCompanies,
  }
}

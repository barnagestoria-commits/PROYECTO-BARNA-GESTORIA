import type { CompanyClientProfile } from "@prisma/client"
import { prisma } from "@/lib/db"
import { DEFAULT_SETTINGS_BY_PROFILE } from "@/lib/fiscal/fiscal-settings"
import { buildGestoriaCompanyCode, resolveCompanyAccessPath } from "@/lib/contabilidad/gestoria-companies"
import {
  createEmptyGestoriaProfile,
  type GestoriaClientDetailDto,
  type GestoriaClientProfileDto,
} from "@/lib/contabilidad/gestoria-client-profile-types"
import {
  fiscalSettingsFromProfileImpresos,
  profileDtoToRecordData,
  profileRecordToDto,
} from "@/lib/contabilidad/gestoria-client-profile-serializers"
import type { CompanySummary } from "@/lib/types/auth"

export type GestoriaClientEntityType = "juridica" | "fisica"

export interface CreateGestoriaClientInput {
  name: string
  cif?: string
  entityType: GestoriaClientEntityType
}

export interface UpdateGestoriaClientInput {
  name: string
  cif?: string
  profile: GestoriaClientProfileDto
}

function normalizeCif(value: string | undefined): string | null {
  const trimmed = value?.trim().toUpperCase()
  return trimmed ? trimmed : null
}

export function resolveGestoriaClientProfile(
  entityType: GestoriaClientEntityType,
): CompanyClientProfile {
  if (entityType === "fisica") {
    return "PERSONA_FISICA"
  }
  return "PYME"
}

export function mapEntityTypeToGestoria(
  entityType: GestoriaClientEntityType,
): "PERSONA_JURIDICA" | "PERSONA_FISICA" {
  return entityType === "fisica" ? "PERSONA_FISICA" : "PERSONA_JURIDICA"
}

async function assertGestoriaCompanyAccess(
  companyId: string,
  accountId: string,
  userId: string,
) {
  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      accountId,
    },
    include: {
      gestoriaProfile: true,
      fiscalSettings: true,
      userAccess: true,
    },
  })

  if (!company) {
    throw new Error("Empresa no encontrada o sin permisos de gestoría.")
  }

  const restrictedAccessCount = await prisma.userCompanyAccess.count({
    where: { userId },
  })

  if (
    restrictedAccessCount > 0 &&
    !company.userAccess.some((access) => access.userId === userId)
  ) {
    throw new Error("Empresa no encontrada o sin permisos de gestoría.")
  }

  return company
}

async function allocateClientCode(accountId: string): Promise<string> {
  const existing = await prisma.companyGestoriaProfile.findMany({
    where: { company: { accountId } },
    select: { clientCode: true },
  })

  const numericCodes = existing
    .map((item) => Number.parseInt(item.clientCode, 10))
    .filter((value) => Number.isFinite(value))

  const next = numericCodes.length > 0 ? Math.max(...numericCodes) + 1 : 1564
  return String(next).padStart(5, "0")
}

export async function createGestoriaClientCompany(
  accountId: string,
  userId: string,
  input: CreateGestoriaClientInput,
): Promise<CompanySummary> {
  const name = input.name.trim()
  if (!name) {
    throw new Error("Indique el nombre o razón social del cliente.")
  }

  const cif = normalizeCif(input.cif)
  const profile = resolveGestoriaClientProfile(input.entityType)
  const fiscalDefaults = DEFAULT_SETTINGS_BY_PROFILE[profile]
  const clientCode = await allocateClientCode(accountId)
  const gestoriaEntityType = mapEntityTypeToGestoria(input.entityType)
  const emptyProfile = createEmptyGestoriaProfile(clientCode)
  emptyProfile.entityType = gestoriaEntityType
  emptyProfile.accessPath = resolveCompanyAccessPath(clientCode, "cloud")

  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: {
        name,
        cif,
        accountId,
      },
    })

    await tx.userCompanyAccess.create({
      data: {
        userId,
        companyId: created.id,
      },
    })

    await tx.companyFiscalSettings.create({
      data: {
        companyId: created.id,
        ...fiscalDefaults,
      },
    })

    await tx.companyGestoriaProfile.create({
      data: {
        companyId: created.id,
        ...profileDtoToRecordData(emptyProfile),
      },
    })

    return created
  })

  return {
    id: company.id,
    name: company.name,
    cif: company.cif,
  }
}

export async function getGestoriaClientDetail(
  companyId: string,
  accountId: string,
  userId: string,
): Promise<GestoriaClientDetailDto> {
  const company = await assertGestoriaCompanyAccess(companyId, accountId, userId)
  const fiscalSettings =
    company.fiscalSettings ??
    DEFAULT_SETTINGS_BY_PROFILE.PYME

  const profileRecord =
    company.gestoriaProfile ??
    (await prisma.companyGestoriaProfile.create({
      data: {
        companyId: company.id,
        ...profileDtoToRecordData(
          createEmptyGestoriaProfile(await allocateClientCode(accountId)),
        ),
      },
    }))

  return {
    id: company.id,
    name: company.name,
    cif: company.cif,
    profile: profileRecordToDto(profileRecord, fiscalSettings),
    fiscalSettings,
  }
}

export async function updateGestoriaClientCompany(
  companyId: string,
  accountId: string,
  userId: string,
  input: UpdateGestoriaClientInput,
): Promise<GestoriaClientDetailDto> {
  const name = input.name.trim()
  if (!name) {
    throw new Error("Indique el nombre o razón social del cliente.")
  }

  await assertGestoriaCompanyAccess(companyId, accountId, userId)

  const cif = normalizeCif(input.cif)
  const profileData = profileDtoToRecordData(input.profile)

  await prisma.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: companyId },
      data: { name, cif },
    })

    const currentFiscal = await tx.companyFiscalSettings.findUnique({
      where: { companyId },
    })

    const fiscalPayload = fiscalSettingsFromProfileImpresos(
      input.profile,
      currentFiscal ?? DEFAULT_SETTINGS_BY_PROFILE.PYME,
    )

    await tx.companyFiscalSettings.upsert({
      where: { companyId },
      create: {
        companyId,
        ...fiscalPayload,
      },
      update: fiscalPayload,
    })

    await tx.companyGestoriaProfile.upsert({
      where: { companyId },
      create: {
        companyId,
        ...profileData,
      },
      update: profileData,
    })
  })

  return getGestoriaClientDetail(companyId, accountId, userId)
}

export async function deleteGestoriaClientCompany(
  companyId: string,
  accountId: string,
  userId: string,
): Promise<void> {
  await assertGestoriaCompanyAccess(companyId, accountId, userId)

  await prisma.company.delete({
    where: { id: companyId },
  })
}

export async function listGestoriaClientProfiles(
  accountId: string,
  userId: string,
): Promise<Map<string, GestoriaClientProfileDto>> {
  const restrictedAccessCount = await prisma.userCompanyAccess.count({
    where: { userId },
  })

  const companies = await prisma.company.findMany({
    where: {
      accountId,
      ...(restrictedAccessCount > 0
        ? { userAccess: { some: { userId } } }
        : {}),
    },
    include: {
      gestoriaProfile: true,
      fiscalSettings: true,
    },
    orderBy: { name: "asc" },
  })

  const map = new Map<string, GestoriaClientProfileDto>()
  companies.forEach((company, index) => {
    const fiscalSettings = company.fiscalSettings ?? DEFAULT_SETTINGS_BY_PROFILE.PYME
    if (company.gestoriaProfile) {
      map.set(company.id, profileRecordToDto(company.gestoriaProfile, fiscalSettings))
      return
    }

    map.set(
      company.id,
      createEmptyGestoriaProfile(buildGestoriaCompanyCode(index)),
    )
  })

  return map
}

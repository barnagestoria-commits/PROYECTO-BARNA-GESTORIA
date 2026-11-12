import { randomBytes } from "crypto"
import { cookies } from "next/headers"
import type {
  AccountBillingStatus,
  AccountType,
  AuthSession,
  CompanyKind,
  CompanySummary,
  RegisterRequest,
  SupportAccess,
  UpdateUserProfileRequest,
  UserRole,
} from "@/lib/types/auth"
import {
  DEFAULT_ENTRY_SHORTCUT_BY_CIF,
  DEFAULT_ENTRY_SHORTCUT_BY_NAME,
  normalizeEntryShortcut,
  validateEntryShortcuts,
} from "@/lib/accounting/entry-shortcuts"
import { canCloseOwnAccount } from "@/lib/auth/account-closure"
import { prisma } from "@/lib/db"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import {
  canSwitchCompanies,
  resolveActiveCompanyId,
} from "@/lib/auth/permissions"
import { userIsPlatformOperator } from "@/lib/auth/platform-operator"
import { selectCompaniesVisibleToUser } from "@/lib/auth/gestoria-access"

import {
  getSessionCookieOptions,
  getSessionExpiry,
  SESSION_COOKIE,
} from "@/lib/auth/session-cookie"
import { parseOptionalBankName, parseOptionalIban } from "@/lib/banking/iban"
import { parseCensusDocumentInput } from "@/lib/company/census-document"
import { parseCnae } from "@/lib/company/cnae"
import { parseCorporateTaxCharacter } from "@/lib/company/corporate-tax"
import { parseCensusBoolean, parseSiiMode } from "@/lib/company/sii"

function createSessionToken(): string {
  return randomBytes(32).toString("hex")
}

export { SESSION_COOKIE }

function toCompanySummary(company: {
  id: string
  name: string
  cif: string | null
  kind?: CompanyKind | null
  activityStartDate?: Date | null
  taxDirectDebitIban?: string | null
  taxDirectDebitBank?: string | null
  salesCollectionIban?: string | null
  salesCollectionBank?: string | null
  cnae?: string | null
  corporateTaxCharacter?: CompanySummary["corporateTaxCharacter"]
  censusDocumentName?: string | null
  censusDocumentKind?: string | null
  censusExtractedAt?: Date | null
  censusExtractedJson?: string | null
  siiMode?: CompanySummary["siiMode"]
  cashBasisSubject?: boolean
  cashBasisRecipient?: boolean
}): CompanySummary {
  return {
    id: company.id,
    name: company.name,
    cif: company.cif,
    kind: company.kind ?? "STANDARD",
    activityStartDate: company.activityStartDate
      ? company.activityStartDate.toISOString().slice(0, 10)
      : null,
    taxDirectDebitIban: company.taxDirectDebitIban ?? null,
    taxDirectDebitBank: company.taxDirectDebitBank ?? null,
    salesCollectionIban: company.salesCollectionIban ?? null,
    salesCollectionBank: company.salesCollectionBank ?? null,
    cnae: company.cnae ?? null,
    corporateTaxCharacter: company.corporateTaxCharacter ?? "SOCIEDAD",
    censusDocumentName: company.censusDocumentName ?? null,
    censusDocumentKind: company.censusDocumentKind ?? null,
    censusExtractedAt: company.censusExtractedAt
      ? company.censusExtractedAt.toISOString()
      : null,
    censusExtractedJson: company.censusExtractedJson ?? null,
    siiMode: company.siiMode ?? "NONE",
    cashBasisSubject: company.cashBasisSubject ?? false,
    cashBasisRecipient: company.cashBasisRecipient ?? false,
  }
}

async function getCompaniesForUser(
  userId: string,
  accountType: AccountType,
  accountId: string,
  role: UserRole,
): Promise<CompanySummary[]> {
  const [owned, access] = await Promise.all([
    prisma.company.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        cif: true,
        kind: true,
        activityStartDate: true,
        taxDirectDebitIban: true,
        taxDirectDebitBank: true,
        salesCollectionIban: true,
        salesCollectionBank: true,
        cnae: true,
        corporateTaxCharacter: true,
        censusDocumentName: true,
        censusDocumentKind: true,
        censusExtractedAt: true,
        censusExtractedJson: true,
        siiMode: true,
        cashBasisSubject: true,
        cashBasisRecipient: true,
      },
    }),
    prisma.userCompanyAccess.findMany({
      where: { userId },
      select: { companyId: true },
    }),
  ])

  return selectCompaniesVisibleToUser({
    accountType,
    role,
    companies: owned.map(toCompanySummary),
    assignedCompanyIds: access.length > 0 ? access.map((row) => row.companyId) : null,
  })
}

async function ensureStoredOperatorFlag(user: {
  id: string
  email: string
  isPlatformOperator?: boolean | null
}): Promise<boolean> {
  const operator = userIsPlatformOperator(user)
  if (operator && !user.isPlatformOperator) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isPlatformOperator: true },
    })
  }
  return operator
}

async function loadCompanyForSupport(companyId: string) {
  return prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      cif: true,
      kind: true,
      accountId: true,
      activityStartDate: true,
      taxDirectDebitIban: true,
      taxDirectDebitBank: true,
      salesCollectionIban: true,
      salesCollectionBank: true,
      cnae: true,
      corporateTaxCharacter: true,
      censusDocumentName: true,
      censusDocumentKind: true,
      censusExtractedAt: true,
      censusExtractedJson: true,
      siiMode: true,
      cashBasisSubject: true,
      cashBasisRecipient: true,
      account: {
        select: {
          name: true,
          users: {
            select: { email: true },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      },
    },
  })
}

async function buildAuthSession(
  user: {
    id: string
    email: string
    name: string
    phone: string | null
    role: UserRole
    accountId: string
    isPlatformOperator?: boolean | null
    entryShortcutByName?: string | null
    entryShortcutByCif?: string | null
    entryShortcutsConfigured?: boolean | null
    account: {
      name: string
      accountType: AccountType
      billingStatus?: AccountBillingStatus | null
      billingPausedAt?: Date | null
    }
  },
  activeCompanyId?: string | null,
): Promise<AuthSession> {
  const operator = await ensureStoredOperatorFlag(user)
  let companies = await getCompaniesForUser(
    user.id,
    user.account.accountType,
    user.accountId,
    user.role,
  )
  let supportAccess: SupportAccess | null = null
  let resolvedActive = resolveActiveCompanyId(companies, activeCompanyId)

  if (operator && activeCompanyId && !companies.some((company) => company.id === activeCompanyId)) {
    const foreign = await loadCompanyForSupport(activeCompanyId)
    if (foreign) {
      companies = [...companies, toCompanySummary(foreign)]
      resolvedActive = foreign.id
      if (foreign.accountId !== user.accountId) {
        supportAccess = {
          companyId: foreign.id,
          companyName: foreign.name,
          accountName: foreign.account.name,
          ownerEmail: foreign.account.users[0]?.email ?? null,
        }
      }
    }
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      accountId: user.accountId,
      accountType: user.account.accountType,
      accountName: user.account.name,
      isPlatformOperator: operator,
      entryShortcutByName:
        normalizeEntryShortcut(user.entryShortcutByName ?? "") || DEFAULT_ENTRY_SHORTCUT_BY_NAME,
      entryShortcutByCif:
        normalizeEntryShortcut(user.entryShortcutByCif ?? "") || DEFAULT_ENTRY_SHORTCUT_BY_CIF,
      entryShortcutsConfigured: Boolean(user.entryShortcutsConfigured),
      accountBillingStatus: user.account.billingStatus === "PAUSED" ? "PAUSED" : "ACTIVE",
      accountBillingPausedAt: user.account.billingPausedAt
        ? user.account.billingPausedAt.toISOString()
        : null,
    },
    companies,
    activeCompanyId: resolvedActive,
    canSwitchCompanies: canSwitchCompanies(user.account.accountType, user.role) || operator,
    supportAccess,
  }
}

export async function registerAccount(input: RegisterRequest): Promise<AuthSession> {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } })
  if (existing) {
    throw new Error("Ya existe una cuenta con este email.")
  }

  const passwordHash = hashPassword(input.password)
  const role: UserRole = input.accountType === "GESTORIA" ? "ADMIN_GESTOR" : "CLIENTE"

  const account = await prisma.account.create({
    data: {
      name: input.companyName,
      accountType: input.accountType,
      users: {
        create: {
          email: input.email.toLowerCase(),
          passwordHash,
          name: input.name,
          phone: input.phone,
          role,
        },
      },
      companies: {
        create: {
          name: input.companyName,
          cif: input.accountType !== "GESTORIA" ? input.cif : undefined,
          kind: input.accountType === "GESTORIA" ? "GESTORIA_PROPIA" : "STANDARD",
        },
      },
    },
    include: {
      users: true,
      companies: true,
    },
  })

  const user = account.users[0]
  const company = account.companies[0]

  if (company) {
    await prisma.userCompanyAccess.create({
      data: {
        userId: user.id,
        companyId: company.id,
      },
    })
  }

  return establishUserSession(user.id, company?.id ?? null)
}

export async function establishUserSession(
  userId: string,
  preferredCompanyId?: string | null,
): Promise<AuthSession> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { account: true },
  })

  const companies = await getCompaniesForUser(
    user.id,
    user.account.accountType,
    user.accountId,
    user.role,
  )
  const token = createSessionToken()
  const activeCompanyId = resolveActiveCompanyId(companies, preferredCompanyId)

  const session = await prisma.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt: getSessionExpiry(),
      activeCompanyId,
    },
  })

  ;(await cookies()).set(SESSION_COOKIE, token, getSessionCookieOptions(session.expiresAt))

  return buildAuthSession(user, session.activeCompanyId)
}

export async function loginAccount(email: string, password: string): Promise<AuthSession> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { account: true },
  })

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Email o contraseña incorrectos.")
  }

  const companies = await getCompaniesForUser(
    user.id,
    user.account.accountType,
    user.accountId,
    user.role,
  )
  return establishUserSession(user.id, resolveActiveCompanyId(companies))
}

export async function logoutAccount(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    await prisma.session.deleteMany({ where: { token } })
  }
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSessionFromToken(token: string | undefined): Promise<AuthSession | null> {
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: { account: true },
      },
    },
  })

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } })
    }
    return null
  }

  return buildAuthSession(session.user, session.activeCompanyId)
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return getSessionFromToken(token)
}

export async function setActiveCompany(companyId: string): Promise<AuthSession> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const session = await getSessionFromToken(token)

  if (!session) {
    throw new Error("Sesión no válida.")
  }

  if (!session.canSwitchCompanies) {
    throw new Error("Tu cuenta no puede cambiar de empresa.")
  }

  if (!session.companies.some((company) => company.id === companyId)) {
    throw new Error("No tienes acceso a esta empresa.")
  }

  await prisma.session.updateMany({
    where: { token: token! },
    data: { activeCompanyId: companyId },
  })

  return { ...session, activeCompanyId: companyId }
}

export async function enterSupportCompany(companyId: string): Promise<AuthSession> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const current = await getSessionFromToken(token)

  if (!current) {
    throw new Error("Sesión no válida.")
  }

  if (!current.user.isPlatformOperator) {
    throw new Error("Solo el operador de Taxlyn puede entrar en otra cuenta.")
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  })

  if (!company) {
    throw new Error("No encontramos esa empresa.")
  }

  await prisma.session.updateMany({
    where: { token: token! },
    data: { activeCompanyId: company.id },
  })
  await prisma.supportAccessEvent.create({
    data: {
      operatorUserId: current.user.id,
      companyId: company.id,
      action: "ENTER",
    },
  })

  const next = await getSessionFromToken(token)
  if (!next) {
    throw new Error("Sesión no válida.")
  }
  return next
}

export async function leaveSupportCompany(): Promise<AuthSession> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const current = await getSessionFromToken(token)

  if (!current) {
    throw new Error("Sesión no válida.")
  }

  if (!current.user.isPlatformOperator) {
    throw new Error("Solo el operador de Taxlyn puede salir de una cuenta de soporte.")
  }

  const ownCompanies = await getCompaniesForUser(
    current.user.id,
    current.user.accountType,
    current.user.accountId,
    current.user.role,
  )

  if (current.supportAccess) {
    await prisma.supportAccessEvent.create({
      data: {
        operatorUserId: current.user.id,
        companyId: current.supportAccess.companyId,
        action: "LEAVE",
      },
    })
  }

  await prisma.session.updateMany({
    where: { token: token! },
    data: { activeCompanyId: resolveActiveCompanyId(ownCompanies, null) },
  })

  const next = await getSessionFromToken(token)
  if (!next) {
    throw new Error("Sesión no válida.")
  }
  return next
}

export async function upgradeAccountPlan(
  targetAccountType: AccountType,
  options?: { gestoriaTierId?: string; empresaTierId?: string },
): Promise<AuthSession> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const session = await getSessionFromToken(token)

  if (!session) {
    throw new Error("Sesión no válida.")
  }

  if (session.user.accountType === targetAccountType) {
    if (targetAccountType === "GESTORIA" && options?.gestoriaTierId) {
      return session
    }
    if (targetAccountType === "EMPRESA" && options?.empresaTierId) {
      return session
    }
    throw new Error("Ya tienes este plan activo.")
  }

  if (session.user.accountType === "GESTORIA") {
    throw new Error("Para cambiar a un plan inferior, contacta con soporte.")
  }

  const upgradePaths: Record<AccountType, AccountType[]> = {
    CLIENTE_FINAL: ["EMPRESA", "GESTORIA"],
    EMPRESA: ["GESTORIA"],
    GESTORIA: [],
  }

  if (!upgradePaths[session.user.accountType]?.includes(targetAccountType)) {
    throw new Error("Mejora de plan no disponible.")
  }

  await prisma.account.update({
    where: { id: session.user.accountId },
    data: { accountType: targetAccountType },
  })

  if (targetAccountType === "GESTORIA") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { role: "ADMIN_GESTOR" },
    })

    if (session.activeCompanyId) {
      await prisma.company.update({
        where: { id: session.activeCompanyId },
        data: { kind: "GESTORIA_PROPIA" },
      })
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { account: true },
  })

  if (!user) {
    throw new Error("Usuario no encontrado.")
  }

  return buildAuthSession(user, session.activeCompanyId)
}

function parseActivityStartDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("La fecha de alta debe tener el formato AAAA-MM-DD.")
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("La fecha de alta no es válida.")
  }
  const year = parsed.getUTCFullYear()
  if (year < 1970 || year > 2100) {
    throw new Error("La fecha de alta queda fuera del rango admitido.")
  }
  return parsed
}

function censusColumns(
  censusDocument: ReturnType<typeof parseCensusDocumentInput>,
): {
  censusDocumentName?: string | null
  censusDocumentKind?: string | null
  censusExtractedAt?: Date | null
  censusExtractedJson?: string | null
} {
  if (censusDocument === undefined) return {}
  if (censusDocument === null) {
    return {
      censusDocumentName: null,
      censusDocumentKind: null,
      censusExtractedAt: null,
      censusExtractedJson: null,
    }
  }
  return {
    censusDocumentName: censusDocument.fileName,
    censusDocumentKind: censusDocument.reading.kind,
    censusExtractedAt: new Date(),
    censusExtractedJson: JSON.stringify(censusDocument.reading),
  }
}

function canEditAccountName(session: AuthSession): boolean {
  return (
    session.user.role === "ADMIN_GESTOR" ||
    session.user.accountType === "CLIENTE_FINAL" ||
    session.user.accountType === "EMPRESA"
  )
}

export async function updateUserProfile(input: UpdateUserProfileRequest): Promise<AuthSession> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const session = await getSessionFromToken(token)

  if (!session) {
    throw new Error("Sesión no válida.")
  }

  const name = input.name?.trim()
  const email = input.email?.trim().toLowerCase()
  const phone =
    input.phone === undefined ? undefined : input.phone?.trim() ? input.phone.trim() : null
  const accountName = input.accountName?.trim()
  const activeCompanyName = input.activeCompanyName?.trim()
  const activeCompanyCif =
    input.activeCompanyCif === undefined
      ? undefined
      : input.activeCompanyCif?.trim()
        ? input.activeCompanyCif.trim().replace(/[^A-Z0-9]/gi, "").toUpperCase()
        : null
  const activityStartDate = parseActivityStartDate(input.activityStartDate)
  const taxDirectDebitIban = parseOptionalIban(input.taxDirectDebitIban)
  const taxDirectDebitBank = parseOptionalBankName(input.taxDirectDebitBank)
  const salesCollectionIban = parseOptionalIban(input.salesCollectionIban)
  const salesCollectionBank = parseOptionalBankName(input.salesCollectionBank)
  const cnae = parseCnae(input.cnae)
  const corporateTaxCharacter = parseCorporateTaxCharacter(input.corporateTaxCharacter)
  const censusDocument = parseCensusDocumentInput(input.censusDocument)
  const siiMode = parseSiiMode(input.siiMode)
  const cashBasisSubject = parseCensusBoolean(input.cashBasisSubject)
  const cashBasisRecipient = parseCensusBoolean(input.cashBasisRecipient)

  if (name !== undefined && !name) {
    throw new Error("El nombre es obligatorio.")
  }

  if (email !== undefined && !email) {
    throw new Error("El email es obligatorio.")
  }

  if (email) {
    const existing = await prisma.user.findFirst({
      where: { email, NOT: { id: session.user.id } },
    })
    if (existing) {
      throw new Error("Ya existe otra cuenta con este email.")
    }
  }

  if (accountName !== undefined && !accountName) {
    throw new Error("El nombre de la cuenta es obligatorio.")
  }

  if (activeCompanyName !== undefined && !activeCompanyName) {
    throw new Error("El nombre de la empresa activa es obligatorio.")
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
      },
    })

    if (accountName !== undefined && canEditAccountName(session)) {
      await tx.account.update({
        where: { id: session.user.accountId },
        data: { name: accountName },
      })
    }

    if (activeCompanyName !== undefined && session.activeCompanyId) {
      if (!session.companies.some((company) => company.id === session.activeCompanyId)) {
        throw new Error("No tienes acceso a la empresa activa.")
      }

      await tx.company.update({
        where: { id: session.activeCompanyId },
        data: {
          ...(activeCompanyName !== undefined ? { name: activeCompanyName } : {}),
          ...(activeCompanyCif !== undefined ? { cif: activeCompanyCif } : {}),
          ...(activityStartDate !== undefined ? { activityStartDate } : {}),
          ...(taxDirectDebitIban !== undefined ? { taxDirectDebitIban } : {}),
          ...(taxDirectDebitBank !== undefined ? { taxDirectDebitBank } : {}),
          ...(salesCollectionIban !== undefined ? { salesCollectionIban } : {}),
          ...(salesCollectionBank !== undefined ? { salesCollectionBank } : {}),
          ...(cnae !== undefined ? { cnae } : {}),
          ...(corporateTaxCharacter !== undefined ? { corporateTaxCharacter } : {}),
          ...censusColumns(censusDocument),
          ...(siiMode !== undefined ? { siiMode } : {}),
          ...(cashBasisSubject !== undefined ? { cashBasisSubject } : {}),
          ...(cashBasisRecipient !== undefined ? { cashBasisRecipient } : {}),
        },
      })
    } else if (
      (activeCompanyCif !== undefined ||
        activityStartDate !== undefined ||
        taxDirectDebitIban !== undefined ||
        taxDirectDebitBank !== undefined ||
        salesCollectionIban !== undefined ||
        salesCollectionBank !== undefined ||
        cnae !== undefined ||
        corporateTaxCharacter !== undefined ||
        censusDocument !== undefined ||
        siiMode !== undefined ||
        cashBasisSubject !== undefined ||
        cashBasisRecipient !== undefined) &&
      session.activeCompanyId
    ) {
      if (!session.companies.some((company) => company.id === session.activeCompanyId)) {
        throw new Error("No tienes acceso a la empresa activa.")
      }

      await tx.company.update({
        where: { id: session.activeCompanyId },
        data: {
          ...(activeCompanyCif !== undefined ? { cif: activeCompanyCif } : {}),
          ...(activityStartDate !== undefined ? { activityStartDate } : {}),
          ...(taxDirectDebitIban !== undefined ? { taxDirectDebitIban } : {}),
          ...(taxDirectDebitBank !== undefined ? { taxDirectDebitBank } : {}),
          ...(salesCollectionIban !== undefined ? { salesCollectionIban } : {}),
          ...(salesCollectionBank !== undefined ? { salesCollectionBank } : {}),
          ...(cnae !== undefined ? { cnae } : {}),
          ...(corporateTaxCharacter !== undefined ? { corporateTaxCharacter } : {}),
          ...censusColumns(censusDocument),
          ...(siiMode !== undefined ? { siiMode } : {}),
          ...(cashBasisSubject !== undefined ? { cashBasisSubject } : {}),
          ...(cashBasisRecipient !== undefined ? { cashBasisRecipient } : {}),
        },
      })
    }
  })

  const updated = await getSessionFromToken(token)
  if (!updated) {
    throw new Error("No se pudo actualizar la sesión.")
  }

  return updated
}

export async function assertCompanyAccess(
  session: AuthSession,
  companyId: string,
): Promise<void> {
  if (!session.activeCompanyId || session.activeCompanyId !== companyId) {
    if (!session.companies.some((company) => company.id === companyId)) {
      throw new Error("No tienes acceso a esta empresa.")
    }
  }

  const allowed = session.companies.some((company) => company.id === companyId)
  if (!allowed) {
    throw new Error("No tienes acceso a esta empresa.")
  }
}

function assertAccountHolder(session: AuthSession) {
  if (!canCloseOwnAccount(session.user.role)) {
    throw new Error("La baja de la suscripción la gestiona quien administra la cuenta.")
  }
}

export async function saveEntryShortcuts(
  session: AuthSession,
  byName: string,
  byCif: string,
): Promise<AuthSession> {
  const choice = {
    byName: normalizeEntryShortcut(byName),
    byCif: normalizeEntryShortcut(byCif),
  }
  const error = validateEntryShortcuts(choice)
  if (error) throw new Error(error)

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      entryShortcutByName: choice.byName,
      entryShortcutByCif: choice.byCif,
      entryShortcutsConfigured: true,
    },
  })

  const updated = await getCurrentSession()
  if (!updated) throw new Error("No se pudo actualizar la sesión.")
  return updated
}

export async function pauseOwnSubscription(session: AuthSession): Promise<AuthSession> {
  assertAccountHolder(session)
  await prisma.account.update({
    where: { id: session.user.accountId },
    data: { billingStatus: "PAUSED", billingPausedAt: new Date() },
  })
  const updated = await getCurrentSession()
  if (!updated) throw new Error("No se pudo actualizar la sesión.")
  return updated
}

export async function resumeOwnSubscription(session: AuthSession): Promise<AuthSession> {
  assertAccountHolder(session)
  await prisma.account.update({
    where: { id: session.user.accountId },
    data: { billingStatus: "ACTIVE", billingPausedAt: null },
  })
  const updated = await getCurrentSession()
  if (!updated) throw new Error("No se pudo actualizar la sesión.")
  return updated
}

export async function deleteOwnAccount(session: AuthSession): Promise<void> {
  assertAccountHolder(session)
  await prisma.account.delete({ where: { id: session.user.accountId } })
}

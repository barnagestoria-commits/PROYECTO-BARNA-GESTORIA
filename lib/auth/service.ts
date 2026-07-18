import { randomBytes } from "crypto"
import { cookies } from "next/headers"
import type { AccountType, AuthSession, CompanySummary, RegisterRequest, UserRole } from "@/lib/types/auth"
import { prisma } from "@/lib/db"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import {
  canSwitchCompanies,
  resolveActiveCompanyId,
} from "@/lib/auth/permissions"

import {
  getSessionCookieOptions,
  getSessionExpiry,
  SESSION_COOKIE,
} from "@/lib/auth/session-cookie"

function createSessionToken(): string {
  return randomBytes(32).toString("hex")
}

export { SESSION_COOKIE }

async function getCompaniesForUser(
  userId: string,
  accountType: AccountType,
  accountId: string,
): Promise<CompanySummary[]> {
  if (accountType === "CLIENTE_FINAL") {
    const access = await prisma.userCompanyAccess.findMany({
      where: { userId },
      include: { company: true },
    })

    if (access.length > 0) {
      return access.map(({ company }) => ({
        id: company.id,
        name: company.name,
        cif: company.cif,
      }))
    }

    const owned = await prisma.company.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
    })

    return owned.map((company) => ({
      id: company.id,
      name: company.name,
      cif: company.cif,
    }))
  }

  const access = await prisma.userCompanyAccess.findMany({
    where: { userId },
    include: { company: true },
    orderBy: { company: { name: "asc" } },
  })

  if (access.length > 0) {
    return access.map(({ company }) => ({
      id: company.id,
      name: company.name,
      cif: company.cif,
    }))
  }

  const managed = await prisma.company.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
  })

  return managed.map((company) => ({
    id: company.id,
    name: company.name,
    cif: company.cif,
  }))
}

async function buildAuthSession(
  user: {
    id: string
    email: string
    name: string
    role: UserRole
    accountId: string
    account: { name: string; accountType: AccountType }
  },
  activeCompanyId?: string | null,
): Promise<AuthSession> {
  const companies = await getCompaniesForUser(user.id, user.account.accountType, user.accountId)
  const canSwitch = canSwitchCompanies(user.account.accountType, user.role)

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accountId: user.accountId,
      accountType: user.account.accountType,
      accountName: user.account.name,
    },
    companies,
    activeCompanyId: resolveActiveCompanyId(companies, activeCompanyId),
    canSwitchCompanies: canSwitch,
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
          cif: input.accountType === "CLIENTE_FINAL" ? input.cif : undefined,
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

  const companies = await getCompaniesForUser(user.id, user.account.accountType, user.accountId)
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

  cookies().set(SESSION_COOKIE, token, getSessionCookieOptions(session.expiresAt))

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

  const companies = await getCompaniesForUser(user.id, user.account.accountType, user.accountId)
  return establishUserSession(user.id, resolveActiveCompanyId(companies))
}

export async function logoutAccount(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (token) {
    await prisma.session.deleteMany({ where: { token } })
  }
  cookies().delete(SESSION_COOKIE)
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
  const token = cookies().get(SESSION_COOKIE)?.value
  return getSessionFromToken(token)
}

export async function setActiveCompany(companyId: string): Promise<AuthSession> {
  const token = cookies().get(SESSION_COOKIE)?.value
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

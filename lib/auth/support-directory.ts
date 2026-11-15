import { prisma } from "@/lib/db"
import { DEMO_ACCOUNT_EMAILS, countDemoAccounts } from "@/lib/auth/demo-accounts"
import type { AccountType, CompanyKind } from "@/lib/types/auth"

export interface SupportDirectoryCompany {
  id: string
  name: string
  cif: string | null
  kind: CompanyKind
}

export interface SupportDirectoryAccount {
  userId: string
  name: string
  email: string
  accountName: string
  accountType: AccountType
  createdAt: string
  blocked: boolean
  blockReason: string | null
  companies: SupportDirectoryCompany[]
}

const RESULT_LIMIT = 80

export async function searchSupportAccounts(query: string): Promise<{
  accounts: SupportDirectoryAccount[]
  truncated: boolean
  totalUsers: number
  blockedUsers: number
  /** Cuentas de ejemplo que existen pero no se listan. */
  demoAccounts: number
}> {
  const q = query.trim()
  const searchFilter = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { account: { name: { contains: q, mode: "insensitive" as const } } },
          {
            account: {
              companies: {
                some: {
                  OR: [
                    { name: { contains: q, mode: "insensitive" as const } },
                    { cif: { contains: q, mode: "insensitive" as const } },
                  ],
                },
              },
            },
          },
        ],
      }
    : {}

  // Las cuentas de ejemplo no son clientes: ni salen en la lista ni cuentan en los totales.
  const notDemo = { email: { notIn: [...DEMO_ACCOUNT_EMAILS] } }
  const where = { AND: [notDemo, searchFilter] }

  const [users, totalUsers, blockedUsers, demoAccounts] = await Promise.all([
    prisma.user.findMany({
      where,
      take: RESULT_LIMIT + 1,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        blockedAt: true,
        blockReason: true,
        account: {
          select: {
            name: true,
            accountType: true,
            companies: {
              select: { id: true, name: true, cif: true, kind: true },
              orderBy: { name: "asc" },
            },
          },
        },
      },
    }),
    prisma.user.count({ where: notDemo }),
    prisma.user.count({ where: { AND: [notDemo, { blockedAt: { not: null } }] } }),
    countDemoAccounts(),
  ])

  const truncated = users.length > RESULT_LIMIT

  return {
    truncated,
    totalUsers,
    blockedUsers,
    demoAccounts,
    accounts: users.slice(0, RESULT_LIMIT).map((user) => ({
      userId: user.id,
      name: user.name,
      email: user.email,
      accountName: user.account.name,
      accountType: user.account.accountType,
      createdAt: user.createdAt.toISOString(),
      blocked: user.blockedAt !== null,
      blockReason: user.blockReason,
      companies: user.account.companies,
    })),
  }
}

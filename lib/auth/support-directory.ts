import { prisma } from "@/lib/db"
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
  companies: SupportDirectoryCompany[]
}

const RESULT_LIMIT = 80

export async function searchSupportAccounts(query: string): Promise<{
  accounts: SupportDirectoryAccount[]
  truncated: boolean
}> {
  const q = query.trim()
  const where = q
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

  const users = await prisma.user.findMany({
    where,
    take: RESULT_LIMIT + 1,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
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
  })

  const truncated = users.length > RESULT_LIMIT

  return {
    truncated,
    accounts: users.slice(0, RESULT_LIMIT).map((user) => ({
      userId: user.id,
      name: user.name,
      email: user.email,
      accountName: user.account.name,
      accountType: user.account.accountType,
      companies: user.account.companies,
    })),
  }
}

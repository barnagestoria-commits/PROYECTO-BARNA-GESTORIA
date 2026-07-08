import { randomBytes } from "crypto"
import type { AuthSession } from "@/lib/types/auth"
import { prisma } from "@/lib/db"
import { hashPassword } from "@/lib/auth/password"
import { establishUserSession } from "@/lib/auth/service"

export interface OAuthProfile {
  email: string
  name?: string | null
}

export async function completeOAuthSignIn(profile: OAuthProfile): Promise<AuthSession> {
  const email = profile.email.trim().toLowerCase()
  if (!email) {
    throw new Error("El proveedor OAuth no devolvió un email válido.")
  }

  const displayName = profile.name?.trim() || email.split("@")[0] || "Usuario"

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { account: true },
  })

  if (existing) {
    return establishUserSession(existing.id)
  }

  const passwordHash = hashPassword(randomBytes(32).toString("hex"))

  const account = await prisma.account.create({
    data: {
      name: displayName,
      accountType: "CLIENTE_FINAL",
      users: {
        create: {
          email,
          passwordHash,
          name: displayName,
          role: "CLIENTE",
        },
      },
      companies: {
        create: {
          name: displayName,
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

  await prisma.userCompanyAccess.create({
    data: {
      userId: user.id,
      companyId: company.id,
    },
  })

  return establishUserSession(user.id, company.id)
}

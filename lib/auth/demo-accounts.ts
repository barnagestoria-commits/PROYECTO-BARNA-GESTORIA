import { prisma } from "@/lib/db"
import { userIsPlatformOperator } from "@/lib/auth/platform-operator"

/**
 * Cuentas de ejemplo (las del seed de desarrollo). No son clientes reales:
 * no salen en el directorio del operador y se pueden retirar con un clic.
 */
export const DEMO_ACCOUNT_EMAILS = [
  "juan@empresa.com",
  "gestor@gestoria.com",
  "admin@gestoria.com",
] as const

const DEMO_SET = new Set<string>(DEMO_ACCOUNT_EMAILS)

export function isDemoAccountEmail(email: string | null | undefined): boolean {
  return Boolean(email) && DEMO_SET.has(email!.trim().toLowerCase())
}

export async function countDemoAccounts(): Promise<number> {
  return prisma.user.count({ where: { email: { in: [...DEMO_ACCOUNT_EMAILS] } } })
}

export interface RemoveDemoAccountsResult {
  removedUsers: number
  removedAccounts: number
  /** Cuentas que comparten espacio con usuarios reales: se quitó solo el usuario de ejemplo. */
  keptSharedAccounts: number
}

/**
 * Borra las cuentas de ejemplo. Dos salvaguardas:
 * - Una cuenta entera (con sus empresas y datos) solo se borra si TODOS sus usuarios son de ejemplo.
 * - Si comparte cuenta con alguien real (por ejemplo el operador), solo se borra el usuario de ejemplo.
 * Un operador de Taxlyn nunca se borra.
 */
export async function removeDemoAccounts(): Promise<RemoveDemoAccountsResult> {
  const demoUsers = await prisma.user.findMany({
    where: { email: { in: [...DEMO_ACCOUNT_EMAILS] } },
    select: { id: true, email: true, accountId: true, isPlatformOperator: true },
  })

  if (demoUsers.some((user) => userIsPlatformOperator(user))) {
    throw new Error("Una de las cuentas de ejemplo es del operador. No se ha borrado nada.")
  }

  const accountIds = [...new Set(demoUsers.map((user) => user.accountId))]
  const result: RemoveDemoAccountsResult = { removedUsers: 0, removedAccounts: 0, keptSharedAccounts: 0 }

  for (const accountId of accountIds) {
    const members = await prisma.user.findMany({
      where: { accountId },
      select: { id: true, email: true, isPlatformOperator: true },
    })
    const onlyDemo = members.every((member) => isDemoAccountEmail(member.email) && !userIsPlatformOperator(member))

    if (onlyDemo) {
      await prisma.account.delete({ where: { id: accountId } })
      result.removedAccounts += 1
      result.removedUsers += members.length
    } else {
      const removed = await prisma.user.deleteMany({
        where: { accountId, email: { in: [...DEMO_ACCOUNT_EMAILS] } },
      })
      result.keptSharedAccounts += 1
      result.removedUsers += removed.count
    }
  }

  return result
}

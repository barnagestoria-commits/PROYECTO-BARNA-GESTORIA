import { prisma } from "@/lib/db"
import { isPlatformOperatorEmail } from "@/lib/auth/platform-operator"

export const LOGIN_FAILURE_LIMIT = 5
export const LOGIN_LOCK_MS = 15 * 60 * 1000
export const OPERATOR_LOGIN_LOCK_MS = 30 * 60 * 1000
export const OPERATOR_SESSION_HOURS = 12

export const LOGIN_LOCKED_MESSAGE =
  "Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo."

export function nextLoginGuard(
  failures: number,
  now: number,
  operator: boolean,
): { failures: number; lockedUntil: number | null } {
  const next = failures + 1
  if (next < LOGIN_FAILURE_LIMIT) {
    return { failures: next, lockedUntil: null }
  }
  const lock = operator ? OPERATOR_LOGIN_LOCK_MS : LOGIN_LOCK_MS
  return { failures: next, lockedUntil: now + lock }
}

export function operatorEmailChangeError(currentEmail: string, nextEmail: string): string | null {
  const current = currentEmail.trim().toLowerCase()
  const next = nextEmail.trim().toLowerCase()
  const currentIsOperator = isPlatformOperatorEmail(current)
  const nextIsOperator = isPlatformOperatorEmail(next)

  if (nextIsOperator && !currentIsOperator) {
    return "Ese correo está reservado para el operador de Taxlyn."
  }
  if (currentIsOperator && next !== current) {
    return "El correo del operador no se cambia desde el perfil."
  }
  return null
}

function emailKey(email: string): string {
  return email.trim().toLowerCase()
}

export async function assertLoginOpen(email: string): Promise<void> {
  const row = await prisma.loginGuard.findUnique({ where: { emailKey: emailKey(email) } })
  if (row?.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
    throw new Error(LOGIN_LOCKED_MESSAGE)
  }
}

export async function recordLoginFailure(email: string): Promise<void> {
  const key = emailKey(email)
  const row = await prisma.loginGuard.findUnique({ where: { emailKey: key } })
  const expiredLock = Boolean(row?.lockedUntil && row.lockedUntil.getTime() <= Date.now())
  const base = !row || expiredLock ? 0 : row.failures
  const next = nextLoginGuard(base, Date.now(), isPlatformOperatorEmail(key))
  await prisma.loginGuard.upsert({
    where: { emailKey: key },
    create: {
      emailKey: key,
      failures: next.failures,
      lockedUntil: next.lockedUntil ? new Date(next.lockedUntil) : null,
    },
    update: {
      failures: next.failures,
      lockedUntil: next.lockedUntil ? new Date(next.lockedUntil) : null,
    },
  })
}

export async function clearLoginFailures(email: string): Promise<void> {
  await prisma.loginGuard.deleteMany({ where: { emailKey: emailKey(email) } })
}

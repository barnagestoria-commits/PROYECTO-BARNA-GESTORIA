/**
 * Ciclo de vida de una cuenta nueva:
 *   días 1-7    prueba gratuita con todas las funciones          (phase "trial")
 *   días 8-22   solo lectura: se puede descargar y contratar     (phase "readonly")
 *   día 23      la cuenta se elimina                              (phase "expired" hasta que pasa la limpieza)
 * Las cuentas con el pago validado (o anteriores a la prueba) están siempre "active".
 */

export const TRIAL_DAYS = 7
export const READONLY_GRACE_DAYS = 15

const DAY_MS = 24 * 60 * 60 * 1000

export type AccessPhase = "active" | "trial" | "readonly" | "expired"

export interface AccountAccess {
  phase: AccessPhase
  /** Fin de la prueba (ISO). Solo en cuentas de prueba. */
  trialEndsAt: string | null
  /** Día en que se elimina la cuenta si no se contrata (ISO). Solo en cuentas de prueba. */
  deletionAt: string | null
  /** Días de prueba que quedan (phase "trial"). */
  daysLeft: number | null
  /** Días que quedan para la eliminación (phases "readonly" y "expired"). */
  daysUntilDeletion: number | null
}

export function trialEndDate(from: Date): Date {
  return new Date(from.getTime() + TRIAL_DAYS * DAY_MS)
}

export function deletionDate(trialEndsAt: Date): Date {
  return new Date(trialEndsAt.getTime() + READONLY_GRACE_DAYS * DAY_MS)
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / DAY_MS))
}

export function computeAccountAccess(
  account: { accessStatus?: "TRIAL" | "ACTIVE" | null; trialEndsAt?: Date | null },
  now: Date = new Date(),
): AccountAccess {
  if (account.accessStatus !== "TRIAL" || !account.trialEndsAt) {
    return { phase: "active", trialEndsAt: null, deletionAt: null, daysLeft: null, daysUntilDeletion: null }
  }

  const trialEnd = account.trialEndsAt
  const deletion = deletionDate(trialEnd)
  const base = { trialEndsAt: trialEnd.toISOString(), deletionAt: deletion.toISOString() }

  if (now.getTime() < trialEnd.getTime()) {
    return { ...base, phase: "trial", daysLeft: daysBetween(now, trialEnd), daysUntilDeletion: null }
  }
  if (now.getTime() < deletion.getTime()) {
    return { ...base, phase: "readonly", daysLeft: null, daysUntilDeletion: daysBetween(now, deletion) }
  }
  return { ...base, phase: "expired", daysLeft: null, daysUntilDeletion: 0 }
}

/** En solo lectura solo se permite escribir en estas rutas: contratar, descargar y la propia cuenta. */
const READONLY_WRITE_PREFIXES = ["/api/checkout/", "/api/account/", "/api/auth/"]

export const ACCESS_BLOCKED_MESSAGE =
  "Tu prueba gratuita ha terminado y la cuenta está en solo lectura. Puedes descargar tus datos o contratar un plan para seguir trabajando."

export function isRequestAllowedForPhase(phase: AccessPhase, method: string, pathname: string): boolean {
  if (phase === "active" || phase === "trial") return true
  const verb = method.toUpperCase()
  if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") return true
  return READONLY_WRITE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export type LifecycleNotice = "trial-2d" | "trial-ended" | "delete-7d" | "delete-1d"

/** Aviso que toca enviar ahora (como mucho uno por pasada) o null. Cada aviso se envía una sola vez. */
export function dueLifecycleNotice(access: AccountAccess, alreadySent: readonly string[]): LifecycleNotice | null {
  const sent = new Set(alreadySent)

  if (access.phase === "trial") {
    if ((access.daysLeft ?? 99) <= 2 && !sent.has("trial-2d")) return "trial-2d"
    return null
  }

  if (access.phase === "readonly" || access.phase === "expired") {
    const days = access.daysUntilDeletion ?? 99
    if (days <= 1 && !sent.has("delete-1d")) return "delete-1d"
    if (days <= 7 && !sent.has("delete-7d")) return "delete-7d"
    if (!sent.has("trial-ended")) return "trial-ended"
  }

  return null
}

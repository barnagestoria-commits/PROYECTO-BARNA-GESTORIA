import { prisma } from "@/lib/db"
import { toAbsoluteUrl } from "@/lib/config/env"
import { computeAccountAccess, dueLifecycleNotice } from "@/lib/billing/access-state"
import { buildLifecycleEmail } from "@/lib/billing/lifecycle-emails"
import { purgeAccount } from "@/lib/billing/purge-account"
import { sendPlainEmail } from "@/lib/mail/send-email"

export interface TrialLifecycleSummary {
  checked: number
  notified: number
  purged: number
  /** Cuentas que se habrían borrado, pero el borrado automático está desactivado. */
  wouldPurge: number
  errors: number
}

/**
 * Pasada diaria sobre las cuentas de prueba: avisa por correo y borra las caducadas.
 * El borrado automático es opt-in: solo se ejecuta con TRIAL_PURGE_ENABLED=1.
 */
export async function runTrialLifecycle(now: Date = new Date()): Promise<TrialLifecycleSummary> {
  const purgeEnabled = process.env.TRIAL_PURGE_ENABLED === "1"
  const summary: TrialLifecycleSummary = { checked: 0, notified: 0, purged: 0, wouldPurge: 0, errors: 0 }

  const accounts = await prisma.account.findMany({
    where: { accessStatus: "TRIAL", trialEndsAt: { not: null } },
    select: {
      id: true,
      accessStatus: true,
      trialEndsAt: true,
      lifecycleNotices: true,
      users: {
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true, name: true, isPlatformOperator: true },
      },
    },
  })

  for (const account of accounts) {
    summary.checked += 1
    try {
      const access = computeAccountAccess(account, now)
      const owner = account.users[0]

      // Nunca se toca una cuenta del operador.
      if (account.users.some((user) => user.isPlatformOperator)) continue

      if (access.phase === "expired") {
        // Si el cliente ya subió un justificante y está sin revisar, no se borra nada.
        const pendingPayments = await prisma.pagoPendiente.count({
          where: { estado: "pendiente", userId: { in: account.users.map((user) => user.id) } },
        })
        if (pendingPayments > 0) continue

        if (purgeEnabled) {
          await purgeAccount(account.id)
          summary.purged += 1
        } else {
          console.warn(`[taxlyn] Cuenta ${account.id} caducada: se borraría, pero TRIAL_PURGE_ENABLED no está activo.`)
          summary.wouldPurge += 1
        }
        continue
      }

      const notice = dueLifecycleNotice(access, account.lifecycleNotices)
      if (!notice || !owner || !access.trialEndsAt || !access.deletionAt) continue

      const email = buildLifecycleEmail(notice, {
        name: owner.name,
        trialEndsAt: access.trialEndsAt,
        deletionAt: access.deletionAt,
        appUrl: toAbsoluteUrl("/").replace(/\/$/, ""),
      })
      const sent = await sendPlainEmail({ to: owner.email, ...email })
      if (sent) {
        await prisma.account.update({
          where: { id: account.id },
          data: { lifecycleNotices: [...account.lifecycleNotices, notice] },
        })
        summary.notified += 1
      }
    } catch (error) {
      summary.errors += 1
      console.error(`[taxlyn] Error en el ciclo de prueba de la cuenta ${account.id}.`, error)
    }
  }

  return summary
}

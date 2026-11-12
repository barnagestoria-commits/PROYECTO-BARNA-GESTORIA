import type { UserRole } from "@/lib/types/auth"

/** La suscripción es de la cuenta. La pausa o el borrado lo hace quien la administra. */
export function canCloseOwnAccount(role: UserRole): boolean {
  return role === "ADMIN_GESTOR" || role === "CLIENTE"
}

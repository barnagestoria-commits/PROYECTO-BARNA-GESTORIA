export const ACCESS_BLOCKED_MESSAGE =
  "Tu acceso a Taxlyn está bloqueado. Escribe a infotaxlyn@gmail.com."

export function blockTargetError(input: {
  operatorUserId: string
  targetUserId: string
  targetIsOperator: boolean
}): string | null {
  if (input.operatorUserId === input.targetUserId || input.targetIsOperator) {
    return "La cuenta del operador no se puede bloquear."
  }
  return null
}

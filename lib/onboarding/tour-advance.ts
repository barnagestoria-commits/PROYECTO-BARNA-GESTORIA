/**
 * Un clic de Siguiente/Atrás debe mover exactamente un paso.
 * Joyride v3 en modo controlado dispara STEP_AFTER y, si el destino
 * aún no está en el DOM, TARGET_NOT_FOUND. Si ambos avanzan el índice,
 * el tour se salta dos pasos.
 */
const ADVANCE_ACTIONS = new Set(["next", "prev"])

export function resolveTourAdvance(input: {
  eventType: string
  action: string
  currentIndex: number
  total: number
  moving: boolean
}): number | null {
  if (input.moving) return null
  if (input.eventType !== "step:after") return null
  if (!ADVANCE_ACTIONS.has(input.action)) return null

  const nextIndex = input.currentIndex + (input.action === "prev" ? -1 : 1)
  if (nextIndex < 0 || nextIndex >= input.total) return null
  if (nextIndex === input.currentIndex) return null
  return nextIndex
}

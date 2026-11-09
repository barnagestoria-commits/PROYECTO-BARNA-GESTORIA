/**
 * Un clic de Siguiente/Atrás mueve exactamente un paso.
 * Joyride v3 en modo controlado dispara STEP_AFTER y, si el destino
 * aún no está en el DOM, TARGET_NOT_FOUND. Si ambos avanzan el índice,
 * el tour muestra dos globos o se salta pasos.
 * El último Siguiente cierra el tour; no vuelve al paso 1.
 */
const ADVANCE_ACTIONS = new Set(["next", "prev"])

export type TourAdvanceResult = number | "complete" | null

export function resolveTourAdvance(input: {
  eventType: string
  action: string
  currentIndex: number
  total: number
  moving: boolean
}): TourAdvanceResult {
  if (input.moving) return null
  if (input.eventType !== "step:after" && input.eventType !== "tour:end") return null
  if (input.eventType === "tour:end") return "complete"
  if (!ADVANCE_ACTIONS.has(input.action)) return null

  if (input.action === "prev") {
    const previousIndex = input.currentIndex - 1
    return previousIndex < 0 ? null : previousIndex
  }

  const nextIndex = input.currentIndex + 1
  if (nextIndex >= input.total) return "complete"
  return nextIndex
}

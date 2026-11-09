const STEP_KEY = "barna-gestoria-onboarding-step-index"

let autoStartConsumed = false

export function consumeTourAutoStart(): boolean {
  if (autoStartConsumed) return false
  autoStartConsumed = true
  return true
}

export function resetTourAutoStartOnLogout(): void {
  autoStartConsumed = false
}

export function persistTourStepIndex(index: number): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(STEP_KEY, String(index))
}

export function readPersistedTourStepIndex(): number | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(STEP_KEY)
  if (raw == null) return null
  const index = Number(raw)
  return Number.isInteger(index) && index >= 0 ? index : null
}

export function clearPersistedTourStepIndex(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(STEP_KEY)
}

export function pruneJoyridePortals(): void {
  if (typeof document === "undefined") return
  document.querySelectorAll("#react-joyride-portal").forEach((node) => {
    node.parentNode?.removeChild(node)
  })
}

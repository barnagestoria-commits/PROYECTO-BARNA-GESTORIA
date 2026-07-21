const GESTORIA_TIER_KEY = "gestoria-subscription-tier"
const EMPRESA_TIER_KEY = "empresa-subscription-tier"
const EMPRESA_SIZING_KEY = "empresa-subscription-sizing"
const EMPRESA_STARTED_KEY = "empresa-subscription-started-at"

export interface StoredEmpresaSizing {
  annualRevenueEuros: number
  monthlyBankMovements: number
}

export function loadStoredGestoriaTierId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(GESTORIA_TIER_KEY)
  } catch {
    return null
  }
}

export function saveStoredGestoriaTierId(tierId: string): void {
  localStorage.setItem(GESTORIA_TIER_KEY, tierId)
}

export function loadStoredEmpresaTierId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(EMPRESA_TIER_KEY)
  } catch {
    return null
  }
}

export function saveStoredEmpresaTierId(tierId: string): void {
  localStorage.setItem(EMPRESA_TIER_KEY, tierId)
}

export function loadStoredEmpresaSizing(): StoredEmpresaSizing | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(EMPRESA_SIZING_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredEmpresaSizing
  } catch {
    return null
  }
}

export function saveStoredEmpresaSizing(sizing: StoredEmpresaSizing): void {
  localStorage.setItem(EMPRESA_SIZING_KEY, JSON.stringify(sizing))
}

export function loadEmpresaSubscriptionStartedAt(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(EMPRESA_STARTED_KEY)
  } catch {
    return null
  }
}

export function saveEmpresaSubscriptionStartedAt(isoDate: string): void {
  localStorage.setItem(EMPRESA_STARTED_KEY, isoDate)
}

export function getEmpresaEvaluationProgress(startedAtIso: string | null): {
  monthsElapsed: number
  monthsRemaining: number
  reviewLabel: string
} {
  if (!startedAtIso) {
    return {
      monthsElapsed: 0,
      monthsRemaining: 12,
      reviewLabel: "La evaluación del primer año comenzará al contratar el plan Empresa.",
    }
  }

  const started = new Date(startedAtIso)
  const now = new Date()
  const monthsElapsed = Math.max(
    0,
    (now.getFullYear() - started.getFullYear()) * 12 + (now.getMonth() - started.getMonth()),
  )
  const monthsRemaining = Math.max(0, 12 - monthsElapsed)

  return {
    monthsElapsed,
    monthsRemaining,
    reviewLabel:
      monthsRemaining === 0
        ? "Periodo de evaluación completado: procede el recálculo de cuota con datos reales."
        : `Evaluación año 1 en curso: ${monthsElapsed} de 12 meses · revisión en ${monthsRemaining} mes(es).`,
  }
}

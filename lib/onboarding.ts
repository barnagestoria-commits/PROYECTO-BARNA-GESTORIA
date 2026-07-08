export const ONBOARDING_STORAGE_KEY = "barna-gestoria-onboarding-v1"

export const ONBOARDING_START_EVENT = "barna:onboarding-start"

export function markOnboardingCompleted() {
  if (typeof window !== "undefined") {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true")
  }
}

export function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return true
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true"
}

export function startOnboardingTour() {
  if (typeof window === "undefined") return
  localStorage.removeItem(ONBOARDING_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(ONBOARDING_START_EVENT))
}

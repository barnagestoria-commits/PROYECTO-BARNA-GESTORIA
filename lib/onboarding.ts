export {
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_PAUSED_KEY,
  ONBOARDING_START_EVENT,
  ONBOARDING_PAUSE_EVENT,
  ONBOARDING_RESUME_EVENT,
  accountTypeToRoleProfile,
  roleProfileLabel,
  getTourStepsForProfile,
} from "@/lib/onboarding/types"
export type {
  OnboardingStepId,
  OnboardingRoleProfile,
  OnboardingTourStepDefinition,
  OnboardingStatus,
} from "@/lib/onboarding/types"

import {
  ONBOARDING_PAUSED_KEY,
  ONBOARDING_START_EVENT,
  ONBOARDING_PAUSE_EVENT,
  ONBOARDING_RESUME_EVENT,
  ONBOARDING_STORAGE_KEY,
} from "@/lib/onboarding/types"

export function markOnboardingCompletedLocal() {
  if (typeof window === "undefined") return
  localStorage.setItem(ONBOARDING_STORAGE_KEY, "true")
  localStorage.removeItem(ONBOARDING_PAUSED_KEY)
}

export function isOnboardingCompletedLocal(): boolean {
  if (typeof window === "undefined") return true
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true"
}

export function isOnboardingPausedLocal(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(ONBOARDING_PAUSED_KEY) === "true"
}

export function pauseOnboardingLocal() {
  if (typeof window === "undefined") return
  localStorage.setItem(ONBOARDING_PAUSED_KEY, "true")
  window.dispatchEvent(new CustomEvent(ONBOARDING_PAUSE_EVENT))
}

export function resumeOnboardingLocal() {
  if (typeof window === "undefined") return
  localStorage.removeItem(ONBOARDING_PAUSED_KEY)
  window.dispatchEvent(new CustomEvent(ONBOARDING_RESUME_EVENT))
}

export function startOnboardingTour() {
  if (typeof window === "undefined") return
  localStorage.removeItem(ONBOARDING_STORAGE_KEY)
  localStorage.removeItem(ONBOARDING_PAUSED_KEY)
  window.dispatchEvent(new CustomEvent(ONBOARDING_START_EVENT))
}

export async function syncOnboardingCompleted(): Promise<void> {
  markOnboardingCompletedLocal()
  try {
    await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    })
  } catch {
    // localStorage sigue siendo la fuente de respaldo
  }
}

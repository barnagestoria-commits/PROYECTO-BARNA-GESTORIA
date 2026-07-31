"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import type { Step, EventData } from "react-joyride"
import { ACTIONS, EVENTS, STATUS } from "react-joyride"
import { useAuth } from "@/components/auth-provider"
import { OnboardingTooltip } from "@/components/onboarding/onboarding-tooltip"
import { apiFetch } from "@/lib/api-client"
import { loadStoredCertificate } from "@/lib/settings/certificate-storage"
import {
  accountTypeToRoleProfile,
  getTourStepsForProfile,
  roleProfileLabel,
  type OnboardingStepId,
  type OnboardingTourStepDefinition,
} from "@/lib/onboarding/types"
import {
  isOnboardingCompletedLocal,
  isOnboardingPausedLocal,
  ONBOARDING_PAUSE_EVENT,
  ONBOARDING_RESUME_EVENT,
  ONBOARDING_START_EVENT,
  pauseOnboardingLocal,
  resumeOnboardingLocal,
  syncOnboardingCompleted,
} from "@/lib/onboarding"

const Joyride = dynamic(() => import("react-joyride").then((mod) => mod.Joyride), { ssr: false })

interface OnboardingContextValue {
  isRunning: boolean
  isPaused: boolean
  startTour: () => void
  pauseTour: () => void
  resumeTour: () => void
  restartTour: () => void
  recommendedStepIds: OnboardingStepId[]
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error("useOnboarding debe usarse dentro de OnboardingProvider")
  }
  return context
}

function routeMatches(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

function waitForSelector(selector: string, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now()
    const tick = () => {
      if (document.querySelector(selector)) {
        resolve(true)
        return
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false)
        return
      }
      window.requestAnimationFrame(tick)
    }
    tick()
  })
}

function toJoyrideSteps(definitions: OnboardingTourStepDefinition[]): Step[] {
  return definitions.map((step) => ({
    target: step.target,
    title: step.title,
    content: step.content,
    placement: step.placement ?? "bottom",
    skipBeacon: true,
    data: { stepId: step.id, route: step.route },
  }))
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { session } = useAuth()

  const roleProfile = accountTypeToRoleProfile(session?.user.accountType ?? "CLIENTE_FINAL")
  const roleLabel = roleProfileLabel(roleProfile)
  const stepDefinitions = useMemo(() => getTourStepsForProfile(roleProfile), [roleProfile])
  const joyrideSteps = useMemo(() => toJoyrideSteps(stepDefinitions), [stepDefinitions])

  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [recommendedStepIds, setRecommendedStepIds] = useState<OnboardingStepId[]>([])
  const [pendingRoute, setPendingRoute] = useState<string | null>(null)

  const refreshRecommendations = useCallback(async () => {
    if (!session) return

    try {
      const data = await apiFetch<{
        success: true
        status: { recommendedStepIds: OnboardingStepId[]; hasCompletedOnboarding: boolean }
      }>("/api/onboarding")

      const hasCertificate = Boolean(loadStoredCertificate())
      const merged = new Set(data.status.recommendedStepIds)
      if (!hasCertificate) merged.add("certificate")

      setRecommendedStepIds(Array.from(merged))

      if (data.status.hasCompletedOnboarding) {
        localStorage.setItem("barna-gestoria-onboarding-v2", "true")
      }
    } catch {
      const merged: OnboardingStepId[] = ["certificate"]
      if (!loadStoredCertificate()) merged.push("certificate")
      setRecommendedStepIds(merged)
    }
  }, [session])

  const navigateToStep = useCallback(
    async (index: number) => {
      const definition = stepDefinitions[index]
      if (!definition) return false

      if (!routeMatches(pathname, definition.route)) {
        setRun(false)
        setPendingRoute(definition.route)
        setStepIndex(index)
        router.push(definition.route)
        return false
      }

      const ready = await waitForSelector(definition.target)
      if (!ready) return false

      setStepIndex(index)
      setRun(true)
      return true
    },
    [pathname, router, stepDefinitions],
  )

  const beginTour = useCallback(
    async (fromIndex = 0) => {
      setIsPaused(false)
      resumeOnboardingLocal()
      await refreshRecommendations()
      await navigateToStep(fromIndex)
    },
    [navigateToStep, refreshRecommendations],
  )

  const startTour = useCallback(() => {
    void beginTour(0)
  }, [beginTour])

  const pauseTour = useCallback(() => {
    setRun(false)
    setIsPaused(true)
    pauseOnboardingLocal()
  }, [])

  const resumeTour = useCallback(() => {
    setIsPaused(false)
    resumeOnboardingLocal()
    void navigateToStep(stepIndex)
  }, [navigateToStep, stepIndex])

  const restartTour = useCallback(() => {
    void fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    }).catch(() => undefined)
    localStorage.removeItem("barna-gestoria-onboarding-v2")
    localStorage.removeItem("barna-gestoria-onboarding-paused")
    void beginTour(0)
  }, [beginTour])

  useEffect(() => {
    if (!session) return
    void refreshRecommendations()
  }, [refreshRecommendations, session])

  useEffect(() => {
    if (!session || pendingRoute === null) return
    if (!routeMatches(pathname, pendingRoute)) return

    const resume = async () => {
      const definition = stepDefinitions[stepIndex]
      if (!definition) return
      const ready = await waitForSelector(definition.target)
      if (ready) {
        setPendingRoute(null)
        setRun(true)
      }
    }

    void resume()
  }, [pathname, pendingRoute, session, stepDefinitions, stepIndex])

  useEffect(() => {
    if (!session) return

    const completed = isOnboardingCompletedLocal()
    const paused = isOnboardingPausedLocal()
    if (completed || paused) return

    const timer = window.setTimeout(() => {
      void beginTour(0)
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [beginTour, session])

  useEffect(() => {
    function handleStart() {
      void beginTour(0)
    }
    function handlePause() {
      setRun(false)
      setIsPaused(true)
    }
    function handleResume() {
      setIsPaused(false)
      void navigateToStep(stepIndex)
    }

    window.addEventListener(ONBOARDING_START_EVENT, handleStart)
    window.addEventListener(ONBOARDING_PAUSE_EVENT, handlePause)
    window.addEventListener(ONBOARDING_RESUME_EVENT, handleResume)
    return () => {
      window.removeEventListener(ONBOARDING_START_EVENT, handleStart)
      window.removeEventListener(ONBOARDING_PAUSE_EVENT, handlePause)
      window.removeEventListener(ONBOARDING_RESUME_EVENT, handleResume)
    }
  }, [beginTour, navigateToStep, stepIndex])

  const handleJoyrideCallback = useCallback(
    (data: EventData) => {
      const { action, index, status, type } = data

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        void syncOnboardingCompleted()
        setRun(false)
        setStepIndex(0)
        setPendingRoute(null)
        return
      }

      if (type === EVENTS.STEP_AFTER) {
        const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1)
        if (nextIndex < 0 || nextIndex >= stepDefinitions.length) return
        void navigateToStep(nextIndex)
      }
    },
    [navigateToStep, stepDefinitions.length],
  )

  const currentStepId = stepDefinitions[stepIndex]?.id

  const contextValue = useMemo<OnboardingContextValue>(
    () => ({
      isRunning: run,
      isPaused,
      startTour,
      pauseTour,
      resumeTour,
      restartTour,
      recommendedStepIds,
    }),
    [isPaused, pauseTour, recommendedStepIds, restartTour, resumeTour, run, startTour],
  )

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      {session && joyrideSteps.length > 0 && (
        <Joyride
          steps={joyrideSteps}
          run={run}
          stepIndex={stepIndex}
          continuous
          scrollToFirstStep
          onEvent={handleJoyrideCallback}
          tooltipComponent={(props) => (
            <OnboardingTooltip
              {...props}
              recommendedStepIds={recommendedStepIds}
              stepId={currentStepId}
              roleLabel={roleLabel}
            />
          )}
          locale={{
            back: "Atrás",
            close: "Cerrar",
            last: "¡Empezar!",
            next: "Siguiente",
            skip: "Saltar tour",
          }}
          options={{
            primaryColor: "#145A32",
            textColor: "#2C2C2C",
            arrowColor: "#ffffff",
            zIndex: 10000,
            overlayColor: "rgba(15, 61, 46, 0.45)",
          }}
        />
      )}
    </OnboardingContext.Provider>
  )
}

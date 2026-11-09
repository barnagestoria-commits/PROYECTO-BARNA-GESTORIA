"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import type { EventData, Step, TooltipRenderProps } from "react-joyride"
import { STATUS } from "react-joyride"
import { useAuth } from "@/components/auth-provider"
import { MobileOnboardingWizard } from "@/components/onboarding/mobile-onboarding-wizard"
import { OnboardingTooltip } from "@/components/onboarding/onboarding-tooltip"
import { apiFetch } from "@/lib/api-client"
import { loadStoredCertificate } from "@/lib/settings/certificate-storage"
import { resolveTourAdvance } from "@/lib/onboarding/tour-advance"
import { tourRouteMatches } from "@/lib/onboarding/tour-route"
import {
  clearPersistedTourStepIndex,
  consumeTourAutoStart,
  persistTourStepIndex,
  pruneJoyridePortals,
  readPersistedTourStepIndex,
  resetTourAutoStartOnLogout,
} from "@/lib/onboarding/tour-session"
import {
  accountTypeToRoleProfile,
  getTourStepsForProfile,
  roleProfileLabel,
  type OnboardingStepId,
  type OnboardingTourStepDefinition,
} from "@/lib/onboarding/types"
import {
  clearOnboardingPausedLocal,
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
  return tourRouteMatches(pathname, route)
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

function toJoyrideSteps(definitions: OnboardingTourStepDefinition[], narrow: boolean): Step[] {
  return definitions.map((step) => ({
    target: step.target,
    title: step.title,
    content: step.content,
    placement: narrow ? "center" : (step.placement ?? "bottom"),
    skipBeacon: true,
    skipScroll: narrow,
    hideOverlay: narrow,
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
  const [narrowViewport, setNarrowViewport] = useState(false)
  const narrowRef = useRef(false)
  const joyrideSteps = useMemo(() => toJoyrideSteps(stepDefinitions, false), [stepDefinitions])

  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [finished, setFinished] = useState(false)
  const [recommendedStepIds, setRecommendedStepIds] = useState<OnboardingStepId[]>([])
  const [pendingRoute, setPendingRoute] = useState<string | null>(null)
  const pathnameRef = useRef(pathname)
  const stepIndexRef = useRef(0)
  const movingRef = useRef(false)
  const finishedRef = useRef(false)
  const extrasRef = useRef({
    recommendedStepIds,
    stepId: stepDefinitions[0]?.id as OnboardingStepId | undefined,
    roleLabel,
  })
  pathnameRef.current = pathname
  stepIndexRef.current = stepIndex
  extrasRef.current = {
    recommendedStepIds,
    stepId: stepDefinitions[stepIndex]?.id,
    roleLabel,
  }

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

  const completeTour = useCallback(() => {
    finishedRef.current = true
    movingRef.current = false
    clearPersistedTourStepIndex()
    setFinished(true)
    setRun(false)
    setStepIndex(0)
    setPendingRoute(null)
    void syncOnboardingCompleted()
    window.requestAnimationFrame(() => pruneJoyridePortals())
  }, [])

  const navigateToStep = useCallback(
    async (index: number) => {
      if (finishedRef.current) {
        movingRef.current = false
        setRun(false)
        return false
      }

      const definition = stepDefinitions[index]
      if (!definition) {
        completeTour()
        return false
      }

      persistTourStepIndex(index)
      setStepIndex(index)
      setRun(false)

      if (!routeMatches(pathnameRef.current, definition.route)) {
        setPendingRoute(definition.route)
        router.push(definition.route)
        return false
      }

      await waitForSelector(definition.target)
      if (finishedRef.current) {
        movingRef.current = false
        return false
      }
      setPendingRoute(null)
      movingRef.current = false
      setRun(true)
      return true
    },
    [completeTour, router, stepDefinitions],
  )

  const beginTour = useCallback(
    async (fromIndex = 0, options?: { force?: boolean }) => {
      if (!options?.force && isOnboardingCompletedLocal()) {
        finishedRef.current = true
        setFinished(true)
        setRun(false)
        return
      }

      finishedRef.current = false
      movingRef.current = false
      setFinished(false)
      setIsPaused(false)
      clearOnboardingPausedLocal()
      void refreshRecommendations()
      if (narrowRef.current) {
        persistTourStepIndex(fromIndex)
        setPendingRoute(null)
        setStepIndex(fromIndex)
        setRun(true)
        return
      }
      await navigateToStep(fromIndex)
    },
    [navigateToStep, refreshRecommendations],
  )

  const startTour = useCallback(() => {
    finishedRef.current = false
    setFinished(false)
    const saved = readPersistedTourStepIndex()
    void beginTour(saved ?? 0, { force: true })
  }, [beginTour])

  const pauseTour = useCallback(() => {
    setRun(false)
    movingRef.current = false
    setIsPaused(true)
    pauseOnboardingLocal()
  }, [])

  const resumeTour = useCallback(() => {
    if (finishedRef.current || isOnboardingCompletedLocal()) return
    setIsPaused(false)
    resumeOnboardingLocal()
    if (narrowRef.current) {
      setRun(true)
      return
    }
    void navigateToStep(stepIndexRef.current)
  }, [navigateToStep])

  const restartTour = useCallback(() => {
    finishedRef.current = false
    setFinished(false)
    void fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    }).catch(() => undefined)
    localStorage.removeItem("barna-gestoria-onboarding-v2")
    localStorage.removeItem("barna-gestoria-onboarding-paused")
    clearPersistedTourStepIndex()
    void beginTour(0, { force: true })
  }, [beginTour])

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)")
    const apply = () => {
      narrowRef.current = media.matches
      setNarrowViewport(media.matches)
    }
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    if (!session) return
    void refreshRecommendations()
  }, [refreshRecommendations, session])

  useEffect(() => {
    if (!session || pendingRoute === null) return
    if (!routeMatches(pathname, pendingRoute)) return

    const resume = async () => {
      if (finishedRef.current) return
      const definition = stepDefinitions[stepIndex]
      if (!definition) {
        completeTour()
        return
      }
      await waitForSelector(definition.target)
      if (finishedRef.current) {
        movingRef.current = false
        return
      }
      setPendingRoute(null)
      movingRef.current = false
      setRun(true)
    }

    void resume()
  }, [completeTour, pathname, pendingRoute, session, stepDefinitions, stepIndex])

  useEffect(() => {
    if (!session) {
      resetTourAutoStartOnLogout()
      finishedRef.current = false
      return
    }
    if (finishedRef.current || isOnboardingCompletedLocal() || isOnboardingPausedLocal()) {
      const done = isOnboardingCompletedLocal() || finishedRef.current
      finishedRef.current = done
      setFinished(done)
      setRun(false)
      return
    }
    if (!consumeTourAutoStart()) return

    const saved = readPersistedTourStepIndex()
    const timer = window.setTimeout(() => {
      if (finishedRef.current || isOnboardingCompletedLocal() || isOnboardingPausedLocal()) return
      void beginTour(saved ?? 0)
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [beginTour, session])

  useEffect(() => {
    function handleStart() {
      finishedRef.current = false
      setFinished(false)
      void beginTour(readPersistedTourStepIndex() ?? 0, { force: true })
    }
    function handlePause() {
      setRun(false)
      setIsPaused(true)
    }
    function handleResume() {
      if (finishedRef.current || isOnboardingCompletedLocal()) return
      setIsPaused(false)
      if (narrowRef.current) {
        setRun(true)
        return
      }
      void navigateToStep(stepIndexRef.current)
    }

    window.addEventListener(ONBOARDING_START_EVENT, handleStart)
    window.addEventListener(ONBOARDING_PAUSE_EVENT, handlePause)
    window.addEventListener(ONBOARDING_RESUME_EVENT, handleResume)
    return () => {
      window.removeEventListener(ONBOARDING_START_EVENT, handleStart)
      window.removeEventListener(ONBOARDING_PAUSE_EVENT, handlePause)
      window.removeEventListener(ONBOARDING_RESUME_EVENT, handleResume)
    }
  }, [beginTour, navigateToStep])

  const handleJoyrideCallback = useCallback(
    (data: EventData) => {
      const { action, status, type } = data

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        completeTour()
        return
      }

      const result = resolveTourAdvance({
        eventType: type,
        action,
        currentIndex: stepIndexRef.current,
        total: stepDefinitions.length,
        moving: movingRef.current,
      })
      if (result === null) return
      if (result === "complete") {
        completeTour()
        return
      }

      movingRef.current = true
      setRun(false)
      void navigateToStep(result)
    },
    [completeTour, navigateToStep, stepDefinitions.length],
  )

  const tooltipComponent = useCallback((props: TooltipRenderProps) => {
    const extras = extrasRef.current
    return (
      <OnboardingTooltip
        {...props}
        recommendedStepIds={extras.recommendedStepIds}
        stepId={extras.stepId}
        roleLabel={extras.roleLabel}
      />
    )
  }, [])

  const joyrideActive = run && !isPaused && !finished

  const contextValue = useMemo<OnboardingContextValue>(
    () => ({
      isRunning: run && !finished,
      isPaused,
      startTour,
      pauseTour,
      resumeTour,
      restartTour,
      recommendedStepIds,
    }),
    [finished, isPaused, pauseTour, recommendedStepIds, restartTour, resumeTour, run, startTour],
  )

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      {session && narrowViewport ? (
        <MobileOnboardingWizard
          open={run && !isPaused && !finished}
          step={stepDefinitions[stepIndex]}
          index={stepIndex}
          total={stepDefinitions.length}
          onBack={() => {
            const previous = Math.max(0, stepIndex - 1)
            persistTourStepIndex(previous)
            setStepIndex(previous)
          }}
          onNext={() => {
            if (stepIndex + 1 >= stepDefinitions.length) {
              completeTour()
              return
            }
            const next = stepIndex + 1
            persistTourStepIndex(next)
            setStepIndex(next)
          }}
          onPause={pauseTour}
          onSkip={completeTour}
        />
      ) : null}
      {session && !narrowViewport && joyrideSteps.length > 0 && (
        <Joyride
          steps={joyrideSteps}
          run={joyrideActive}
          stepIndex={stepIndex}
          continuous
          scrollToFirstStep
          onEvent={handleJoyrideCallback}
          tooltipComponent={tooltipComponent}
          locale={{
            back: "Atrás",
            close: "Cerrar",
            last: "Terminar",
            next: "Siguiente",
            skip: "Saltar tour",
          }}
          options={{
            primaryColor: "#145A32",
            textColor: "#2C2C2C",
            arrowColor: "#ffffff",
            zIndex: 10000,
            overlayColor: "rgba(15, 61, 46, 0.45)",
            overlayClickAction: false,
          }}
        />
      )}
    </OnboardingContext.Provider>
  )
}

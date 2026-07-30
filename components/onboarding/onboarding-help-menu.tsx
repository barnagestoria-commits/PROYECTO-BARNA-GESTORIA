"use client"

import { HelpCircle, Pause, Play, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { startOnboardingTour } from "@/lib/onboarding"
import { useOnboarding } from "@/components/onboarding/onboarding-provider"

interface OnboardingHelpMenuProps {
  className?: string
}

export function OnboardingHelpMenu({ className }: OnboardingHelpMenuProps) {
  const { isRunning, isPaused, pauseTour, resumeTour, restartTour, recommendedStepIds } =
    useOnboarding()

  return (
    <div className={cn("relative group", className)}>
      <button
        type="button"
        className="rounded-lg p-2 text-white/65 transition-colors hover:bg-white/10 hover:text-white"
        title="Ayuda y tour guiado"
        aria-label="Ayuda y tour guiado"
        onClick={() => {
          if (isPaused) {
            resumeTour()
          } else if (!isRunning) {
            startOnboardingTour()
          }
        }}
      >
        <HelpCircle className="h-4 w-4" />
        {recommendedStepIds.length > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold-400 ring-2 ring-[#141a17]" />
        )}
      </button>

      <div className="invisible absolute right-0 top-full z-[120] mt-2 min-w-[220px] rounded-xl border border-white/10 bg-[#1c221f] py-1 opacity-0 shadow-2xl transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
          Tour guiado
        </p>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
          onClick={() => startOnboardingTour()}
        >
          <Play className="h-4 w-4" />
          {isRunning ? "Reanudar tour" : "Iniciar tour"}
        </button>
        {isRunning && !isPaused && (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
            onClick={pauseTour}
          >
            <Pause className="h-4 w-4" />
            Pausar tour
          </button>
        )}
        {isPaused && (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
            onClick={resumeTour}
          >
            <Play className="h-4 w-4" />
            Continuar tour
          </button>
        )}
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
          onClick={restartTour}
        >
          <RotateCcw className="h-4 w-4" />
          Reiniciar tour
        </button>
        {recommendedStepIds.length > 0 && (
          <p className="border-t border-white/10 px-3 py-2 text-xs text-gold-200/90">
            {recommendedStepIds.length} paso
            {recommendedStepIds.length === 1 ? "" : "s"} con acción recomendada
          </p>
        )}
      </div>
    </div>
  )
}

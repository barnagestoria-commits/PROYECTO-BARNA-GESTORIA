"use client"

import type { TooltipRenderProps } from "react-joyride"
import { cn } from "@/lib/utils"
import type { OnboardingStepId } from "@/lib/onboarding/types"

interface OnboardingTooltipProps extends TooltipRenderProps {
  recommendedStepIds: OnboardingStepId[]
  stepId?: OnboardingStepId
  roleLabel: string
}

function renderMarkdownish(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-pine-900">
        {part}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}

export function OnboardingTooltip({
  backProps,
  closeProps,
  continuous,
  index,
  isLastStep,
  primaryProps,
  skipProps,
  step,
  size,
  recommendedStepIds,
  stepId,
  roleLabel,
}: OnboardingTooltipProps) {
  const isRecommended = stepId ? recommendedStepIds.includes(stepId) : false

  return (
    <div className="max-w-sm rounded-xl border border-sand-200 bg-white p-4 shadow-2xl">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
          Tour {roleLabel}
        </span>
        {isRecommended && (
          <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-900">
            Acción recomendada
          </span>
        )}
        <span className="ml-auto text-[11px] text-graphite-400">
          {index + 1} / {size}
        </span>
      </div>

      {step.title && (
        <h3 className="mb-2 text-base font-bold text-pine-900">{step.title as string}</h3>
      )}
      <p className="mb-4 text-sm leading-relaxed text-graphite-700">
        {renderMarkdownish(String(step.content ?? ""))}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          {...skipProps}
          className="text-xs font-medium text-graphite-500 hover:text-graphite-800"
          type="button"
        >
          Saltar tour
        </button>
        <div className="flex items-center gap-2">
          {index > 0 && (
            <button
              {...backProps}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
              type="button"
            >
              Atrás
            </button>
          )}
          <button
            {...primaryProps}
            className={cn(
              "rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-pine-900",
            )}
            type="button"
          >
            {continuous && !isLastStep ? "Siguiente" : "¡Empezar!"}
          </button>
        </div>
      </div>

      <button {...closeProps} className="sr-only" type="button">
        Cerrar
      </button>
    </div>
  )
}

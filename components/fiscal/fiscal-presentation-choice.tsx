"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ExternalLink, Landmark, Save, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FiscalExportButtons } from "@/components/report-export-buttons"
import { getFiscalPresentationChoice } from "@/lib/fiscal/presentation-choice"
import { cn } from "@/lib/utils"

interface FiscalPresentationChoiceProps {
  model: string
  quarter: string | number
  year?: number
  disabled?: boolean
  variant?: "cards" | "inline"
  menuPlacement?: "top" | "bottom"
  className?: string
}

export function FiscalPresentationChoicePanel({
  model,
  quarter,
  year,
  disabled = false,
  variant = "cards",
  menuPlacement = "bottom",
  className,
}: FiscalPresentationChoiceProps) {
  const choice = useMemo(
    () => getFiscalPresentationChoice({ modelCode: model, quarter }),
    [model, quarter],
  )

  if (variant === "inline") {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-xs text-graphite-500">{choice.headerDescription}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="gap-2 bg-[#1a4480] hover:bg-[#153a6b]"
            disabled={disabled}
            asChild
          >
            <a href={choice.sedeUrl} target="_blank" rel="noreferrer">
              <Landmark className="h-4 w-4" />
              {choice.sedeTitle}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
          <FiscalExportButtons
            model={model}
            quarter={quarter}
            year={year}
            disabled={disabled}
            compact
            officialOnly
            menuPlacement={menuPlacement}
          />
        </div>
      </div>
    )
  }

  return (
    <section
      id="presentacion-modelo"
      className={cn("border-x border-b border-black bg-white", className)}
      aria-label="Formas de presentar el modelo"
    >
      <div className="bg-[#1a4480] px-4 py-3 text-white">
        <h2 className="text-sm font-bold">{choice.headerTitle}</h2>
        <p className="mt-0.5 text-xs text-white/85">{choice.headerDescription}</p>
      </div>

      <div className="grid md:grid-cols-2">
        <div className="space-y-3 border-b border-black p-4 md:border-b-0 md:border-r">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1a4480]">
            {choice.sedeOptionLabel}
          </p>
          <div className="flex items-start gap-2">
            <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-[#1a4480]" />
            <div>
              <p className="text-sm font-semibold text-slate-900">{choice.sedeTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{choice.sedeDescription}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-2 bg-[#1a4480] hover:bg-[#153a6b]"
              disabled={disabled}
              asChild
            >
              <a href={choice.sedeUrl} target="_blank" rel="noreferrer">
                {choice.sedeCta}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-2 border-slate-300" asChild>
              <Link href={choice.certificateHref}>
                <ShieldCheck className="h-4 w-4" />
                Certificado digital
              </Link>
            </Button>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
            {choice.filesOptionLabel}
          </p>
          <div className="flex items-start gap-2">
            <Save className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800" />
            <div>
              <p className="text-sm font-semibold text-slate-900">{choice.filesTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{choice.filesDescription}</p>
            </div>
          </div>
          {choice.offersModelFile ? (
            <p className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">{choice.modelFileLabel}.</span> {choice.modelFileHint}
            </p>
          ) : null}
          {choice.offersBooks ? (
            <p className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">{choice.booksLabel}.</span> {choice.booksHint}
            </p>
          ) : null}
          <FiscalExportButtons
            model={model}
            quarter={quarter}
            year={year}
            disabled={disabled}
            compact
            officialOnly
            menuPlacement={menuPlacement}
          />
        </div>
      </div>
    </section>
  )
}

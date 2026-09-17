"use client"

import { useEffect, type ReactNode } from "react"
import { ArrowLeft, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccountingModalProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  onBack?: () => void
  backLabel?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  layer?: "base" | "nested" | "top"
  tone?: "default" | "danger"
}

export function AccountingModal({
  open,
  title,
  subtitle,
  onClose,
  onBack,
  backLabel = "Volver",
  children,
  footer,
  className,
  layer = "base",
  tone = "default",
}: AccountingModalProps) {
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (onBack) onBack()
        else onClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onBack, onClose])

  if (!open) return null

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-end justify-center p-4 sm:items-center",
        layer === "top" ? "z-[160]" : layer === "nested" ? "z-[140]" : "z-[120]",
      )}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl",
          tone === "danger" ? "border border-red-300" : "border border-sand-300",
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="accounting-modal-title"
      >
        <div
          className={cn(
            "flex items-start justify-between gap-3 border-b px-4 py-3",
            tone === "danger"
              ? "border-red-200 bg-red-50"
              : "border-sand-200 bg-sand-50",
          )}
        >
          <div className="flex min-w-0 items-start gap-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="mt-0.5 rounded-lg p-2 text-graphite-500 hover:bg-white hover:text-pine-900"
                aria-label={backLabel}
                title={backLabel}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <div className="min-w-0">
              <h2
                id="accounting-modal-title"
                className={cn(
                  "text-lg font-semibold",
                  tone === "danger" ? "text-red-800" : "text-pine-900",
                )}
              >
                {title}
              </h2>
              {subtitle && (
                <p
                  className={cn(
                    "mt-0.5 text-sm",
                    tone === "danger" ? "font-medium text-red-700" : "text-graphite-500",
                  )}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-lg p-2 hover:bg-white",
              tone === "danger"
                ? "text-red-600 hover:text-red-800"
                : "text-graphite-500 hover:text-pine-900",
            )}
            aria-label="Cerrar ventana"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div
            className={cn(
              "border-t px-4 py-3",
              tone === "danger" ? "border-red-200 bg-red-50" : "border-sand-200 bg-sand-50",
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

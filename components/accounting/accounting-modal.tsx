"use client"

import { useEffect, type ReactNode } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccountingModalProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function AccountingModal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  className,
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
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-sand-300 bg-white shadow-2xl",
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="accounting-modal-title"
      >
        <div className="flex items-start justify-between border-b border-sand-200 bg-sand-50 px-4 py-3">
          <div>
            <h2 id="accounting-modal-title" className="text-lg font-semibold text-pine-900">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-graphite-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-graphite-500 hover:bg-white hover:text-pine-900"
            aria-label="Cerrar ventana"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="border-t border-sand-200 bg-sand-50 px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

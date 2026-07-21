"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ContactActionsMenuProps {
  contactName: string
  onEdit: () => void
  onCreateInvoice: () => void
  onDelete: () => void
}

export function ContactActionsMenu({
  contactName,
  onEdit,
  onCreateInvoice,
  onDelete,
}: ContactActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-2 text-graphite-500 transition-colors hover:bg-sand-100 hover:text-pine-900"
        aria-label={`Acciones para ${contactName}`}
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-sand-200 bg-white py-1 shadow-lg">
          <MenuButton icon={Pencil} label="Editar" onClick={() => { onEdit(); setOpen(false) }} />
          <MenuButton
            icon={FileText}
            label="Crear factura"
            onClick={() => { onCreateInvoice(); setOpen(false) }}
          />
          <MenuButton
            icon={Trash2}
            label="Eliminar"
            destructive
            onClick={() => { onDelete(); setOpen(false) }}
          />
        </div>
      )}
    </div>
  )
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Pencil
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
        destructive
          ? "text-red-600 hover:bg-red-50"
          : "text-graphite-700 hover:bg-sand-50",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  )
}

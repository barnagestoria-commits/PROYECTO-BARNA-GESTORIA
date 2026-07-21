import { cn } from "@/lib/utils"
import type { ContactType } from "@/lib/contacts/types"

const TYPE_STYLES: Record<ContactType, string> = {
  cliente: "border-blue-500/20 bg-blue-500/10 text-blue-600",
  proveedor: "border-purple-500/20 bg-purple-500/10 text-purple-600",
  ambos: "border-amber-500/20 bg-amber-500/10 text-amber-600",
}

const TYPE_LABELS: Record<ContactType, string> = {
  cliente: "Cliente",
  proveedor: "Proveedor",
  ambos: "Ambos",
}

export function ContactTypeBadge({ tipo, className }: { tipo: ContactType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        TYPE_STYLES[tipo],
        className,
      )}
    >
      {TYPE_LABELS[tipo]}
    </span>
  )
}

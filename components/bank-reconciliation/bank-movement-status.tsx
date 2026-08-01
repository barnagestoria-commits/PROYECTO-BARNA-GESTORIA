import { CheckSquare, Circle, X } from "lucide-react"
import type { BankMovementView } from "@/lib/bank-reconciliation/types"
import { cn } from "@/lib/utils"

export const BANK_MOVEMENT_STATUS_LABELS: Record<
  BankMovementView["status"],
  { label: string; description: string }
> = {
  PENDIENTE: {
    label: "No interpretado",
    description: "Movimiento importado sin vincular a contabilidad",
  },
  CONCILIADO: {
    label: "Interpretado",
    description: "Vinculado a un asiento del diario (572/570)",
  },
  REVISADO: {
    label: "Revisado",
    description: "Conciliación comprobada y cerrada",
  },
  IGNORADO: {
    label: "No contabilizable",
    description: "Movimiento excluido de la conciliación",
  },
}

export function BankMovementStatusIcon({
  status,
  className,
}: {
  status: BankMovementView["status"]
  className?: string
}) {
  if (status === "IGNORADO") {
    return <X className={cn("h-4 w-4 text-red-600", className)} aria-hidden />
  }

  if (status === "REVISADO") {
    return (
      <span
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-sm border border-emerald-700 bg-emerald-600 text-white",
          className,
        )}
        aria-hidden
      >
        <CheckSquare className="h-3 w-3" strokeWidth={3} />
      </span>
    )
  }

  if (status === "CONCILIADO") {
    return <Circle className={cn("h-3.5 w-3.5 fill-emerald-500 text-emerald-600", className)} aria-hidden />
  }

  return <Circle className={cn("h-3.5 w-3.5 fill-amber-400 text-amber-500", className)} aria-hidden />
}

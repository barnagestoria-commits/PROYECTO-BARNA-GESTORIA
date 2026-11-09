import { cn } from "@/lib/utils"
import { APP_NAME } from "@/lib/brand"

export function TaxlynMark({ className }: { className?: string }) {
  return (
    <img
      src="/images/taxlyn-mark.png"
      alt={APP_NAME}
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  )
}

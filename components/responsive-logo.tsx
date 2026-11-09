import { cn } from "@/lib/utils"
import { APP_NAME, APP_NAME_SHORT } from "@/lib/brand"
import { TaxlynMark } from "@/components/taxlyn-mark"

interface ResponsiveLogoProps {
  size?: "sm" | "md" | "lg"
  showText?: boolean
  className?: string
  textClassName?: string
}

export function ResponsiveLogo({ size = "md", showText = false, className, textClassName }: ResponsiveLogoProps) {
  const sizeClasses = {
    sm: "w-7 h-7 md:w-8 md:h-8",
    md: "w-8 h-8 md:w-10 md:h-10",
    lg: "w-10 h-10 md:w-12 md:h-12",
  }

  const textSizeClasses = {
    sm: "text-base md:text-lg",
    md: "text-lg md:text-xl",
    lg: "text-xl md:text-2xl",
  }

  return (
    <div className="flex items-center gap-2 md:gap-3">
      <TaxlynMark className={cn(sizeClasses[size], className)} />
      {showText ? (
        <span className={cn("font-bold tracking-wide text-emerald-800", textSizeClasses[size], textClassName)}>
          <span className="hidden sm:inline">{APP_NAME}</span>
          <span className="sm:hidden">{APP_NAME_SHORT}</span>
        </span>
      ) : null}
    </div>
  )
}

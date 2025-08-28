"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

interface PageLoadingProps {
  message?: string
  size?: "sm" | "md" | "lg"
}

export function PageLoading({ message = "Cargando...", size = "md" }: PageLoadingProps) {
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] space-y-4">
      <div className="relative">
        <Image
          src="/images/barna-logo-updated.png"
          alt="Barna Gestoría"
          width={size === "sm" ? 48 : size === "md" ? 64 : 96}
          height={size === "sm" ? 48 : size === "md" ? 64 : 96}
          className={cn("object-contain animate-pulse", sizeClasses[size])}
        />

        {/* Spinner alrededor del logo */}
        <div
          className={cn(
            "absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-600 animate-spin",
            size === "sm" && "border-2",
            size === "md" && "border-3",
            size === "lg" && "border-4",
          )}
          style={{
            width: size === "sm" ? "56px" : size === "md" ? "72px" : "104px",
            height: size === "sm" ? "56px" : size === "md" ? "72px" : "104px",
            top: "-4px",
            left: "-4px",
          }}
        />
      </div>

      <p className="text-emerald-600 font-medium animate-pulse">{message}</p>
    </div>
  )
}

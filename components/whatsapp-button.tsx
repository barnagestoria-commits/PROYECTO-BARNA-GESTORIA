"use client"

import { Button } from "@/components/ui/button"
import { MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface WhatsAppButtonProps {
  phoneNumber?: string
  message?: string
  businessName?: string
  variant?: "default" | "floating" | "inline"
  size?: "sm" | "md" | "lg"
  className?: string
}

export function WhatsAppButton({
  phoneNumber = "634090785",
  message,
  businessName = "Barna Gestoría",
  variant = "default",
  size = "md",
  className,
}: WhatsAppButtonProps) {
  const defaultMessage = `Hola ${businessName}, me gustaría obtener información sobre sus servicios de gestoría.`

  const openWhatsApp = () => {
    const finalMessage = message || defaultMessage
    const encodedMessage = encodeURIComponent(finalMessage)
    const whatsappUrl = `https://wa.me/34${phoneNumber}?text=${encodedMessage}`
    window.open(whatsappUrl, "_blank")
  }

  if (variant === "floating") {
    return (
      <Button
        onClick={openWhatsApp}
        className={cn(
          "fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg bg-green-500 hover:bg-green-600 text-white",
          "md:bottom-4 md:right-20",
          className,
        )}
        title="Contactar por WhatsApp"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    )
  }

  const sizeClasses = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4",
    lg: "h-12 px-6 text-lg",
  }

  return (
    <Button
      onClick={openWhatsApp}
      className={cn(
        "bg-green-500 hover:bg-green-600 text-white",
        sizeClasses[size],
        variant === "inline" && "w-full",
        className,
      )}
    >
      <MessageCircle className={cn("mr-2", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4")} />
      WhatsApp
    </Button>
  )
}

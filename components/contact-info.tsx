"use client"

import { Phone, Mail, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WhatsAppButton } from "./whatsapp-button"

interface ContactInfoProps {
  variant?: "default" | "footer" | "card"
  showIcons?: boolean
}

export function ContactInfo({ variant = "default", showIcons = true }: ContactInfoProps) {
  const contactData = {
    phone: "634090785",
    email: "barnagestoria@gmail.com",
    address: "Barcelona, España",
  }

  const handlePhoneClick = () => {
    window.open(`tel:+34${contactData.phone}`, "_self")
  }

  const handleEmailClick = () => {
    window.open(`mailto:${contactData.email}`, "_self")
  }

  if (variant === "footer") {
    return (
      <div className="space-y-2 text-emerald-100">
        <p className="flex items-center gap-2">
          {showIcons && <MapPin className="h-4 w-4" />}📍 {contactData.address}
        </p>
        <button
          onClick={handlePhoneClick}
          className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer"
        >
          {showIcons && <Phone className="h-4 w-4" />}📞 +34 {contactData.phone.slice(0, 3)}{" "}
          {contactData.phone.slice(3, 6)} {contactData.phone.slice(6)}
        </button>
        <button
          onClick={handleEmailClick}
          className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer"
        >
          {showIcons && <Mail className="h-4 w-4" />}
          ✉️ {contactData.email}
        </button>
        <div className="pt-2">
          <WhatsAppButton
            size="sm"
            message="Hola Barna Gestoría, me gustaría obtener información sobre sus servicios."
          />
        </div>
      </div>
    )
  }

  if (variant === "card") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
          <Phone className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium text-emerald-800">Teléfono</p>
            <Button
              variant="link"
              className="p-0 h-auto text-emerald-700 hover:text-emerald-800"
              onClick={handlePhoneClick}
            >
              +34 {contactData.phone.slice(0, 3)} {contactData.phone.slice(3, 6)} {contactData.phone.slice(6)}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
          <Mail className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium text-emerald-800">Email</p>
            <Button
              variant="link"
              className="p-0 h-auto text-emerald-700 hover:text-emerald-800"
              onClick={handleEmailClick}
            >
              {contactData.email}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
          <MapPin className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium text-emerald-800">Ubicación</p>
            <p className="text-emerald-700">{contactData.address}</p>
          </div>
        </div>

        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="font-medium text-green-800 mb-2">WhatsApp Business</p>
          <WhatsAppButton
            variant="inline"
            message="Hola Barna Gestoría, me gustaría obtener información sobre sus servicios."
          />
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {showIcons && <Phone className="h-4 w-4 text-emerald-600" />}
        <Button
          variant="link"
          className="p-0 h-auto text-emerald-700 hover:text-emerald-800"
          onClick={handlePhoneClick}
        >
          +34 {contactData.phone.slice(0, 3)} {contactData.phone.slice(3, 6)} {contactData.phone.slice(6)}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {showIcons && <Mail className="h-4 w-4 text-emerald-600" />}
        <Button
          variant="link"
          className="p-0 h-auto text-emerald-700 hover:text-emerald-800"
          onClick={handleEmailClick}
        >
          {contactData.email}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {showIcons && <MapPin className="h-4 w-4 text-emerald-600" />}
        <span className="text-emerald-700">{contactData.address}</span>
      </div>
      <div className="pt-2">
        <WhatsAppButton size="sm" message="Hola Barna Gestoría, me gustaría obtener información sobre sus servicios." />
      </div>
    </div>
  )
}

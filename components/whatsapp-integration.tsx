"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, Phone, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface WhatsAppTemplate {
  id: string
  title: string
  description: string
  message: string
  category: "consulta" | "urgente" | "informacion" | "cita"
}

interface WhatsAppIntegrationProps {
  phoneNumber?: string
  businessName?: string
  className?: string
}

export function WhatsAppIntegration({
  phoneNumber = "634090785",
  businessName = "Taxlyn",
  className,
}: WhatsAppIntegrationProps) {
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null)

  const whatsappTemplates: WhatsAppTemplate[] = [
    {
      id: "consulta-general",
      title: "El programa",
      description: "Qué es Taxlyn y cómo empezar",
      message: `Hola ${businessName}, quiero información sobre el programa de gestión. ¿Me podéis explicar cómo funciona?`,
      category: "consulta",
    },
    {
      id: "consulta-fiscal",
      title: "Impuestos",
      description: "IVA, modelos y cierre en Taxlyn",
      message: `Hola ${businessName}, quiero ver cómo queda el IVA y los modelos en el programa.`,
      category: "consulta",
    },
    {
      id: "consulta-contabilidad",
      title: "Contabilidad",
      description: "Asientos, IVA y cierre en el programa",
      message: `Hola ${businessName}, quiero ver cómo queda la contabilidad en Taxlyn.`,
      category: "consulta",
    },
    {
      id: "alta-cuenta",
      title: "Alta de cuenta",
      description: "Autónomo, empresa o despacho",
      message: `Hola ${businessName}, quiero darme de alta en el programa. Soy autónomo / empresa / despacho.`,
      category: "informacion",
    },
    {
      id: "demo",
      title: "Ver el programa",
      description: "Para que te enseñemos Taxlyn",
      message: `Hola ${businessName}, me gustaría que me enseñarais el programa. ¿Cuándo podéis?`,
      category: "cita",
    },
    {
      id: "urgente",
      title: "Soporte urgente",
      description: "Un problema con la cuenta o un plazo",
      message: `Hola ${businessName}, tengo un problema urgente con el programa. ¿Podéis echarme un cable?`,
      category: "urgente",
    },
  ]

  const openWhatsApp = (message: string) => {
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/34${phoneNumber}?text=${encodedMessage}`
    window.open(whatsappUrl, "_blank")
  }

  const copyToClipboard = async (text: string, templateId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedTemplate(templateId)
      setTimeout(() => setCopiedTemplate(null), 2000)
    } catch (err) {
      console.error("Error copying to clipboard:", err)
    }
  }

  const getCategoryColor = (category: WhatsAppTemplate["category"]) => {
    switch (category) {
      case "urgente":
        return "bg-red-100 text-red-800"
      case "cita":
        return "bg-blue-100 text-blue-800"
      case "informacion":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-emerald-100 text-emerald-800"
    }
  }

  const getCategoryLabel = (category: WhatsAppTemplate["category"]) => {
    switch (category) {
      case "urgente":
        return "Urgente"
      case "cita":
        return "Demo"
      case "informacion":
        return "Información"
      default:
        return "Consulta"
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* WhatsApp Business Info */}
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-green-800">WhatsApp Business</CardTitle>
              <CardDescription className="text-green-600">Contacta directamente con {businessName}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-green-200">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">+34 {phoneNumber}</p>
                <p className="text-sm text-green-600">Respuesta rápida garantizada</p>
              </div>
            </div>
            <Button
              className="bg-green-500 hover:bg-green-600 text-white"
              onClick={() => openWhatsApp(`Hola ${businessName}, me gustaría información sobre el programa de gestión.`)}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Abrir Chat
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Message Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Mensajes Predefinidos</CardTitle>
          <CardDescription>Selecciona el tipo de consulta para abrir WhatsApp con el mensaje apropiado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {whatsappTemplates.map((template) => (
              <Card key={template.id} className="border-gray-200 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.title}</CardTitle>
                    <Badge className={getCategoryColor(template.category)}>{getCategoryLabel(template.category)}</Badge>
                  </div>
                  <CardDescription className="text-sm">{template.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border-l-4 border-green-500">
                      {template.message}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                        onClick={() => openWhatsApp(template.message)}
                      >
                        <MessageCircle className="h-3 w-3 mr-1" />
                        Enviar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-300 bg-transparent"
                        onClick={() => copyToClipboard(template.message, template.id)}
                      >
                        {copiedTemplate === template.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>Contacto directo para situaciones específicas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center gap-2 border-green-200 hover:bg-green-50 bg-transparent"
              onClick={() =>
                openWhatsApp(
                  `Hola ${businessName}, tengo una consulta urgente que necesita atención inmediata. ¿Podrían ayudarme?`,
                )
              }
            >
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-red-600" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">Consulta Urgente</p>
                <p className="text-xs text-gray-500">Atención inmediata</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center gap-2 border-green-200 hover:bg-green-50 bg-transparent"
              onClick={() =>
                openWhatsApp(
                  `Hola ${businessName}, me gustaría una demo o videollamada para ver el programa. ¿Cuándo podéis?`,
                )
              }
            >
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">Ver el programa</p>
                <p className="text-xs text-gray-500">Demo o videollamada</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center gap-2 border-green-200 hover:bg-green-50 bg-transparent"
              onClick={() =>
                openWhatsApp(
                  `Hola ${businessName}, me gustaría información de las cuentas y precios de Taxlyn (autónomo, empresa o despacho).`,
                )
              }
            >
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">Cuentas y precios</p>
                <p className="text-xs text-gray-500">Autónomo, empresa o despacho</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-amber-800">Horarios de Atención WhatsApp</p>
              <p className="text-sm text-amber-600">Lunes a Viernes: 9:00 - 18:00 | Sábados: 9:00 - 14:00</p>
              <p className="text-xs text-amber-500 mt-1">Fuera del horario, responderemos lo antes posible</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

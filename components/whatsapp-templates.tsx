"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageCircle, Copy, Check, Send, FileText, AlertCircle, Info } from "lucide-react"

interface WhatsAppTemplate {
  id: string
  name: string
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION"
  language: string
  status: "APPROVED" | "PENDING" | "REJECTED"
  components: {
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS"
    format?: "TEXT" | "MEDIA" | "LOCATION"
    text?: string
    example?: {
      header_text?: string[]
      body_text?: string[][]
    }
    buttons?: Array<{
      type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"
      text: string
      url?: string
      phone_number?: string
    }>
  }[]
  description: string
  useCase: string
}

interface WhatsAppTemplatesProps {
  phoneNumber?: string
  businessName?: string
}

export function WhatsAppTemplates({
  phoneNumber = "634090785",
  businessName = "Barna Gestoría",
}: WhatsAppTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null)
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({})
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null)

  const whatsappTemplates: WhatsAppTemplate[] = [
    {
      id: "cita_confirmacion",
      name: "cita_confirmacion",
      category: "UTILITY",
      language: "es",
      status: "APPROVED",
      description: "Confirmación de cita programada",
      useCase: "Confirmar citas con clientes",
      components: [
        {
          type: "HEADER",
          format: "TEXT",
          text: "Confirmación de Cita - {{1}}",
          example: {
            header_text: ["Barna Gestoría"],
          },
        },
        {
          type: "BODY",
          text: "Hola {{1}},\n\nTu cita ha sido confirmada para el {{2}} a las {{3}}.\n\n📍 Ubicación: Barcelona\n👤 Asesor: {{4}}\n📋 Motivo: {{5}}\n\nSi necesitas reprogramar, responde a este mensaje.\n\n¡Te esperamos!",
          example: {
            body_text: [["Juan Pérez", "15 de enero", "10:00", "María García", "Asesoría fiscal"]],
          },
        },
        {
          type: "FOOTER",
          text: "Barna Gestoría - Contable, Fiscal y Laboral",
        },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "QUICK_REPLY",
              text: "Confirmar asistencia",
            },
            {
              type: "QUICK_REPLY",
              text: "Reprogramar",
            },
            {
              type: "PHONE_NUMBER",
              text: "Llamar",
              phone_number: `+34${phoneNumber}`,
            },
          ],
        },
      ],
    },
    {
      id: "documento_recibido",
      name: "documento_recibido",
      category: "UTILITY",
      language: "es",
      status: "APPROVED",
      description: "Confirmación de recepción de documentos",
      useCase: "Notificar recepción de documentos fiscales",
      components: [
        {
          type: "HEADER",
          format: "TEXT",
          text: "Documentos Recibidos ✅",
        },
        {
          type: "BODY",
          text: "Hola {{1}},\n\nHemos recibido correctamente tus documentos:\n\n📄 {{2}}\n📅 Fecha de recepción: {{3}}\n🔄 Estado: En proceso\n\nTe notificaremos cuando estén procesados.\n\nTiempo estimado: {{4}} días hábiles.",
          example: {
            body_text: [["Juan Pérez", "Facturas enero 2024", "15/01/2024", "3-5"]],
          },
        },
        {
          type: "FOOTER",
          text: "Barna Gestoría - Tu documentación en buenas manos",
        },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "QUICK_REPLY",
              text: "Ver estado",
            },
            {
              type: "QUICK_REPLY",
              text: "Enviar más documentos",
            },
          ],
        },
      ],
    },
    {
      id: "recordatorio_vencimiento",
      name: "recordatorio_vencimiento",
      category: "UTILITY",
      language: "es",
      status: "APPROVED",
      description: "Recordatorio de vencimientos fiscales",
      useCase: "Recordar fechas importantes de obligaciones fiscales",
      components: [
        {
          type: "HEADER",
          format: "TEXT",
          text: "⚠️ Recordatorio Importante",
        },
        {
          type: "BODY",
          text: "Hola {{1}},\n\nTe recordamos que tienes una obligación fiscal próxima a vencer:\n\n📋 {{2}}\n📅 Fecha límite: {{3}}\n⏰ Días restantes: {{4}}\n\n{{5}}\n\nSi tienes dudas, contáctanos inmediatamente.",
          example: {
            body_text: [
              ["Juan Pérez", "Declaración IVA T4", "30/01/2024", "5", "Ya tenemos toda la documentación necesaria"],
            ],
          },
        },
        {
          type: "FOOTER",
          text: "Barna Gestoría - Nunca olvides una fecha importante",
        },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "QUICK_REPLY",
              text: "Todo listo",
            },
            {
              type: "QUICK_REPLY",
              text: "Necesito ayuda",
            },
            {
              type: "PHONE_NUMBER",
              text: "Llamar urgente",
              phone_number: `+34${phoneNumber}`,
            },
          ],
        },
      ],
    },
    {
      id: "bienvenida_cliente",
      name: "bienvenida_cliente",
      category: "UTILITY",
      language: "es",
      status: "APPROVED",
      description: "Mensaje de bienvenida para nuevos clientes",
      useCase: "Dar la bienvenida a clientes que se registran",
      components: [
        {
          type: "HEADER",
          format: "TEXT",
          text: "¡Bienvenido a {{1}}! 🎉",
          example: {
            header_text: ["Barna Gestoría"],
          },
        },
        {
          type: "BODY",
          text: "Hola {{1}},\n\n¡Gracias por confiar en nosotros!\n\nYa puedes acceder a tu panel de cliente:\n🌐 {{2}}\n\nTu asesor asignado: {{3}}\n📞 Contacto directo: {{4}}\n\nEstamos aquí para ayudarte con todas tus necesidades contables, fiscales y laborales.",
          example: {
            body_text: [["Juan Pérez", "portal.barnagestoria.com", "María García", "+34 634 090 785"]],
          },
        },
        {
          type: "FOOTER",
          text: "Barna Gestoría - Tu socio de confianza",
        },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "URL",
              text: "Acceder al portal",
              url: "https://{{1}}",
            },
            {
              type: "QUICK_REPLY",
              text: "Programar primera cita",
            },
          ],
        },
      ],
    },
    {
      id: "proceso_completado",
      name: "proceso_completado",
      category: "UTILITY",
      language: "es",
      status: "APPROVED",
      description: "Notificación de proceso completado",
      useCase: "Informar cuando se completa un trámite o proceso",
      components: [
        {
          type: "HEADER",
          format: "TEXT",
          text: "✅ Proceso Completado",
        },
        {
          type: "BODY",
          text: "Hola {{1}},\n\n¡Excelentes noticias! Hemos completado:\n\n📋 {{2}}\n📅 Fecha de finalización: {{3}}\n📄 Documentos generados: {{4}}\n\n{{5}}\n\nPuedes descargar los documentos desde tu panel o solicitarlos por este medio.",
          example: {
            body_text: [
              [
                "Juan Pérez",
                "Declaración IRPF 2023",
                "15/01/2024",
                "Borrador y justificantes",
                "Todo ha sido presentado correctamente ante Hacienda",
              ],
            ],
          },
        },
        {
          type: "FOOTER",
          text: "Barna Gestoría - Trabajo completado con éxito",
        },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "QUICK_REPLY",
              text: "Descargar documentos",
            },
            {
              type: "QUICK_REPLY",
              text: "Solicitar explicación",
            },
            {
              type: "QUICK_REPLY",
              text: "Valorar servicio",
            },
          ],
        },
      ],
    },
    {
      id: "promocion_servicios",
      name: "promocion_servicios",
      category: "MARKETING",
      language: "es",
      status: "APPROVED",
      description: "Promoción de servicios adicionales",
      useCase: "Informar sobre nuevos servicios o promociones",
      components: [
        {
          type: "HEADER",
          format: "TEXT",
          text: "🎯 Nuevos Servicios Disponibles",
        },
        {
          type: "BODY",
          text: "Hola {{1}},\n\nTenemos nuevos servicios que pueden interesarte:\n\n✨ {{2}}\n💰 Precio especial: {{3}}\n⏰ Válido hasta: {{4}}\n\n{{5}}\n\n¿Te gustaría más información?",
          example: {
            body_text: [
              [
                "Juan Pérez",
                "Digitalización de documentos",
                "50€/mes",
                "31/01/2024",
                "Incluye almacenamiento en la nube y acceso 24/7",
              ],
            ],
          },
        },
        {
          type: "FOOTER",
          text: "Barna Gestoría - Siempre innovando para ti",
        },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "QUICK_REPLY",
              text: "Me interesa",
            },
            {
              type: "QUICK_REPLY",
              text: "Más información",
            },
            {
              type: "URL",
              text: "Ver todos los servicios",
              url: "https://barnagestoria.com/servicios",
            },
          ],
        },
      ],
    },
  ]

  const getCategoryColor = (category: WhatsAppTemplate["category"]) => {
    switch (category) {
      case "UTILITY":
        return "bg-blue-100 text-blue-800"
      case "MARKETING":
        return "bg-purple-100 text-purple-800"
      case "AUTHENTICATION":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusColor = (status: WhatsAppTemplate["status"]) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const generateTemplateMessage = (template: WhatsAppTemplate, variables: Record<string, string>) => {
    let message = ""

    template.components.forEach((component) => {
      if (component.type === "HEADER" && component.text) {
        message += `*${replaceVariables(component.text, variables)}*\n\n`
      } else if (component.type === "BODY" && component.text) {
        message += `${replaceVariables(component.text, variables)}\n\n`
      } else if (component.type === "FOOTER" && component.text) {
        message += `_${component.text}_`
      }
    })

    return message.trim()
  }

  const replaceVariables = (text: string, variables: Record<string, string>) => {
    return text.replace(/\{\{(\d+)\}\}/g, (match, number) => {
      return variables[`var${number}`] || `{{${number}}}`
    })
  }

  const extractVariables = (template: WhatsAppTemplate) => {
    const variables = new Set<string>()

    template.components.forEach((component) => {
      if (component.text) {
        const matches = component.text.match(/\{\{(\d+)\}\}/g)
        if (matches) {
          matches.forEach((match) => {
            const number = match.replace(/[{}]/g, "")
            variables.add(`var${number}`)
          })
        }
      }
    })

    return Array.from(variables).sort()
  }

  const sendWhatsAppTemplate = (template: WhatsAppTemplate, variables: Record<string, string>) => {
    const message = generateTemplateMessage(template, variables)
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/34${phoneNumber}?text=${encodedMessage}`
    window.open(whatsappUrl, "_blank")
  }

  const copyTemplateMessage = async (template: WhatsAppTemplate, variables: Record<string, string>) => {
    const message = generateTemplateMessage(template, variables)
    try {
      await navigator.clipboard.writeText(message)
      setCopiedTemplate(template.id)
      setTimeout(() => setCopiedTemplate(null), 2000)
    } catch (err) {
      console.error("Error copying to clipboard:", err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-blue-800">WhatsApp Business Templates</CardTitle>
              <CardDescription className="text-blue-600">
                Templates oficiales aprobados por WhatsApp Business API
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-white rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-800">{whatsappTemplates.length}</div>
              <div className="text-sm text-blue-600">Templates Activos</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-green-800">
                {whatsappTemplates.filter((t) => t.status === "APPROVED").length}
              </div>
              <div className="text-sm text-green-600">Aprobados</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-purple-800">
                {whatsappTemplates.filter((t) => t.category === "UTILITY").length}
              </div>
              <div className="text-sm text-purple-600">Utilidad</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates">Templates Disponibles</TabsTrigger>
          <TabsTrigger value="sender">Enviar Template</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4">
            {whatsappTemplates.map((template) => (
              <Card key={template.id} className="border-gray-200 hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        {template.category === "UTILITY" && <FileText className="h-5 w-5 text-blue-600" />}
                        {template.category === "MARKETING" && <Info className="h-5 w-5 text-purple-600" />}
                        {template.category === "AUTHENTICATION" && <AlertCircle className="h-5 w-5 text-green-600" />}
                      </div>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription className="text-sm">{template.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getCategoryColor(template.category)}>{template.category}</Badge>
                      <Badge className={getStatusColor(template.status)}>{template.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Caso de uso:</p>
                      <p className="text-sm text-gray-600">{template.useCase}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Vista previa:</p>
                      <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-green-500 text-sm">
                        {template.components.map((component, index) => (
                          <div key={index} className="mb-2">
                            {component.type === "HEADER" && component.text && (
                              <div className="font-bold text-gray-800">
                                {component.example?.header_text
                                  ? replaceVariables(component.text, {
                                      var1: component.example.header_text[0] || "Valor",
                                    })
                                  : component.text}
                              </div>
                            )}
                            {component.type === "BODY" && component.text && (
                              <div className="text-gray-700 whitespace-pre-line">
                                {component.example?.body_text
                                  ? replaceVariables(component.text, {
                                      var1: component.example.body_text[0][0] || "Nombre",
                                      var2: component.example.body_text[0][1] || "Valor 2",
                                      var3: component.example.body_text[0][2] || "Valor 3",
                                      var4: component.example.body_text[0][3] || "Valor 4",
                                      var5: component.example.body_text[0][4] || "Valor 5",
                                    })
                                  : component.text}
                              </div>
                            )}
                            {component.type === "FOOTER" && component.text && (
                              <div className="text-xs text-gray-500 italic mt-2">{component.text}</div>
                            )}
                            {component.type === "BUTTONS" && component.buttons && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {component.buttons.map((button, btnIndex) => (
                                  <Badge key={btnIndex} variant="outline" className="text-xs">
                                    {button.text}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-600 text-blue-700 hover:bg-blue-50 bg-transparent"
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Usar Template
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-300 bg-transparent"
                        onClick={() => copyTemplateMessage(template, {})}
                      >
                        {copiedTemplate === template.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sender" className="space-y-6">
          {selectedTemplate ? (
            <Card>
              <CardHeader>
                <CardTitle>Enviar Template: {selectedTemplate.name}</CardTitle>
                <CardDescription>Completa las variables y envía el mensaje</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Variables del Template:</h4>
                    {extractVariables(selectedTemplate).map((variable) => (
                      <div key={variable} className="space-y-2">
                        <Label htmlFor={variable}>Variable {variable.replace("var", "")}</Label>
                        <Input
                          id={variable}
                          placeholder={`Valor para {{${variable.replace("var", "")}}}`}
                          value={templateVariables[variable] || ""}
                          onChange={(e) =>
                            setTemplateVariables((prev) => ({
                              ...prev,
                              [variable]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Vista Previa:</h4>
                    <div className="p-4 bg-gray-50 rounded-lg border min-h-[200px]">
                      <div className="text-sm whitespace-pre-line">
                        {generateTemplateMessage(selectedTemplate, templateVariables)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    className="bg-green-500 hover:bg-green-600 text-white"
                    onClick={() => sendWhatsAppTemplate(selectedTemplate, templateVariables)}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Enviar por WhatsApp
                  </Button>
                  <Button variant="outline" onClick={() => copyTemplateMessage(selectedTemplate, templateVariables)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Mensaje
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Selecciona un Template</h3>
                <p className="text-gray-600">Elige un template de la pestaña anterior para personalizarlo y enviarlo</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

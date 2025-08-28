"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, X, Send, Phone, Mail, Bot, Minimize2, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { WhatsAppButton } from "./whatsapp-button"

interface Message {
  id: string
  text: string
  sender: "user" | "bot" | "agent"
  timestamp: Date
  type?: "text" | "contact" | "options" | "whatsapp"
  options?: string[]
}

interface ChatWidgetProps {
  className?: string
}

export function ChatWidget({ className }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Simular horario de atención (9:00 - 18:00, Lun-Vie)
  const isBusinessHours = () => {
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay() // 0 = Domingo, 1 = Lunes, etc.
    return day >= 1 && day <= 5 && hour >= 9 && hour < 18
  }

  useEffect(() => {
    setIsOnline(isBusinessHours())
    const interval = setInterval(() => {
      setIsOnline(isBusinessHours())
    }, 60000) // Verificar cada minuto

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Mensaje de bienvenida
      const welcomeMessage: Message = {
        id: "welcome",
        text: isOnline
          ? "¡Hola! Soy el asistente virtual de Barna Gestoría. ¿En qué puedo ayudarte hoy?"
          : "¡Hola! Actualmente estamos fuera del horario de atención (L-V 9:00-18:00). Puedes dejarnos tu consulta y te responderemos lo antes posible.",
        sender: "bot",
        timestamp: new Date(),
        type: "options",
        options: [
          "Información sobre servicios",
          "Consulta fiscal",
          "Gestión laboral",
          "Hablar con un agente",
          "Contactar por WhatsApp",
        ],
      }
      setMessages([welcomeMessage])
    }
  }, [isOpen, isOnline])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!isOpen && messages.length > 1) {
      setHasNewMessages(true)
    }
  }, [messages, isOpen])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsTyping(true)

    // Simular respuesta del bot
    setTimeout(
      () => {
        const botResponse = generateBotResponse(text.trim())
        setMessages((prev) => [...prev, botResponse])
        setIsTyping(false)
      },
      1000 + Math.random() * 2000,
    )
  }

  const generateBotResponse = (userText: string): Message => {
    const text = userText.toLowerCase()

    if (text.includes("whatsapp") || text.includes("whats")) {
      return {
        id: Date.now().toString(),
        text: "¡Perfecto! Puedes contactarnos directamente por WhatsApp para una atención más rápida y personalizada.",
        sender: "bot",
        timestamp: new Date(),
        type: "whatsapp",
      }
    }

    if (text.includes("servicio") || text.includes("qué hacen") || text.includes("información")) {
      return {
        id: Date.now().toString(),
        text: "Ofrecemos servicios de:\n\n• Contabilidad y Administración\n• Asesoría Fiscal y Tributaria\n• Gestión Laboral y Nóminas\n• Constitución de Empresas\n• Trámites con Hacienda y Seguridad Social\n\n¿Te interesa algún servicio en particular?",
        sender: "bot",
        timestamp: new Date(),
        type: "options",
        options: ["Más información", "Contactar por WhatsApp", "Solicitar presupuesto"],
      }
    }

    if (text.includes("fiscal") || text.includes("hacienda") || text.includes("impuesto")) {
      return {
        id: Date.now().toString(),
        text: "En asesoría fiscal te ayudamos con:\n\n• Declaraciones de IRPF\n• IVA trimestral y anual\n• Impuesto de Sociedades\n• Planificación fiscal\n• Recursos ante Hacienda\n\n¿Necesitas ayuda con algún trámite específico?",
        sender: "bot",
        timestamp: new Date(),
        type: "options",
        options: ["Consulta por WhatsApp", "Agendar cita", "Más información"],
      }
    }

    if (text.includes("laboral") || text.includes("nómina") || text.includes("trabajador")) {
      return {
        id: Date.now().toString(),
        text: "En gestión laboral nos encargamos de:\n\n• Altas y bajas de trabajadores\n• Nóminas mensuales\n• Contratos laborales\n• Seguros sociales\n• Finiquitos y liquidaciones\n\n¿Tienes alguna consulta laboral específica?",
        sender: "bot",
        timestamp: new Date(),
        type: "options",
        options: ["Consulta por WhatsApp", "Información de contacto", "Solicitar presupuesto"],
      }
    }

    if (text.includes("contacto") || text.includes("teléfono") || text.includes("email")) {
      return {
        id: Date.now().toString(),
        text: "Puedes contactarnos por múltiples canales:",
        sender: "bot",
        timestamp: new Date(),
        type: "contact",
      }
    }

    if (text.includes("agente") || text.includes("persona") || text.includes("humano")) {
      return {
        id: Date.now().toString(),
        text: "Te recomiendo contactarnos por WhatsApp para una atención más directa y rápida con nuestro equipo.",
        sender: "bot",
        timestamp: new Date(),
        type: "whatsapp",
      }
    }

    if (text.includes("precio") || text.includes("coste") || text.includes("tarifa")) {
      return {
        id: Date.now().toString(),
        text: "Nuestras tarifas varían según el servicio y las necesidades específicas de cada cliente. Te recomiendo que nos contactes para hacer una valoración personalizada sin compromiso.",
        sender: "bot",
        timestamp: new Date(),
        type: "options",
        options: ["Consulta por WhatsApp", "Llamar ahora", "Enviar email"],
      }
    }

    if (text.includes("horario") || text.includes("cuándo") || text.includes("abierto")) {
      return {
        id: Date.now().toString(),
        text:
          "Nuestros horarios de atención son:\n\n• Lunes a Viernes: 9:00 - 18:00\n• Sábados: 9:00 - 14:00\n• Domingos: Cerrado\n\nActualmente estamos " +
          (isOnline ? "🟢 ONLINE" : "🔴 OFFLINE") +
          "\n\n¡También puedes escribirnos por WhatsApp!",
        sender: "bot",
        timestamp: new Date(),
        type: "whatsapp",
      }
    }

    // Respuesta por defecto
    return {
      id: Date.now().toString(),
      text: "Gracias por tu consulta. Para poder ayudarte mejor, te recomiendo que nos contactes directamente. ¡WhatsApp es nuestra forma más rápida de comunicación!",
      sender: "bot",
      timestamp: new Date(),
      type: "options",
      options: ["Contactar por WhatsApp", "Llamar ahora", "Enviar email"],
    }
  }

  const handleOptionClick = (option: string) => {
    handleSendMessage(option)
  }

  const handleContactAction = (type: "phone" | "email") => {
    if (type === "phone") {
      window.open("tel:+34634090785", "_self")
    } else {
      window.open("mailto:barnagestoria@gmail.com", "_self")
    }
  }

  const toggleChat = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setHasNewMessages(false)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className={cn("fixed bottom-4 right-4 z-50", className)}>
      {/* WhatsApp Floating Button */}
      <WhatsAppButton
        variant="floating"
        message="Hola Barna Gestoría, me gustaría obtener información sobre sus servicios."
      />

      {/* Chat Window */}
      {isOpen && (
        <Card
          className={cn(
            "w-80 md:w-96 mb-4 shadow-2xl border-emerald-200 transition-all duration-300",
            isMinimized ? "h-16" : "h-96 md:h-[500px]",
          )}
        >
          {/* Header */}
          <CardHeader className="pb-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ResponsiveLogo size="sm" className="brightness-0 invert" />
                <div>
                  <CardTitle className="text-sm font-medium">Barna Gestoría</CardTitle>
                  <div className="flex items-center gap-1 text-xs">
                    <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-400" : "bg-red-400")} />
                    {isOnline ? "En línea" : "Fuera de horario"}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-white hover:bg-white/20"
                  onClick={() => setIsMinimized(!isMinimized)}
                >
                  {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-white hover:bg-white/20"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {!isMinimized && (
            <>
              {/* Messages */}
              <CardContent className="flex-1 p-4 h-64 md:h-80 overflow-y-auto space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className="space-y-2">
                    <div className={cn("flex", message.sender === "user" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[80%] p-3 rounded-lg text-sm",
                          message.sender === "user"
                            ? "bg-emerald-600 text-white rounded-br-sm"
                            : "bg-gray-100 text-gray-800 rounded-bl-sm",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {message.sender !== "user" && (
                            <Bot className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="whitespace-pre-line">{message.text}</p>
                            <p
                              className={cn(
                                "text-xs mt-1 opacity-70",
                                message.sender === "user" ? "text-emerald-100" : "text-gray-500",
                              )}
                            >
                              {formatTime(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp button */}
                    {message.type === "whatsapp" && (
                      <div className="flex justify-start ml-6">
                        <WhatsAppButton
                          size="sm"
                          variant="inline"
                          message="Hola Barna Gestoría, me gustaría obtener más información sobre sus servicios."
                          className="max-w-xs"
                        />
                      </div>
                    )}

                    {/* Contact buttons */}
                    {message.type === "contact" && (
                      <div className="flex gap-2 justify-start ml-6">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 bg-transparent"
                          onClick={() => handleContactAction("phone")}
                        >
                          <Phone className="h-3 w-3 mr-1" />
                          Llamar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 bg-transparent"
                          onClick={() => handleContactAction("email")}
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          Email
                        </Button>
                        <WhatsAppButton size="sm" message="Hola Barna Gestoría, me gustaría contactar con ustedes." />
                      </div>
                    )}

                    {/* Option buttons */}
                    {message.type === "options" && message.options && (
                      <div className="flex flex-wrap gap-1 justify-start ml-6">
                        {message.options.map((option, index) => (
                          <Button
                            key={index}
                            size="sm"
                            variant="outline"
                            className="text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 bg-transparent"
                            onClick={() => handleOptionClick(option)}
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 p-3 rounded-lg rounded-bl-sm max-w-[80%]">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-emerald-600" />
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </CardContent>

              {/* Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Escribe tu consulta..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleSendMessage(inputValue)
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleSendMessage(inputValue)}
                    disabled={!inputValue.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Chat Toggle Button */}
      <Button
        className={cn(
          "h-14 w-14 rounded-full shadow-lg bg-emerald-600 hover:bg-emerald-700 relative mr-16",
          isOpen && "bg-emerald-700",
        )}
        onClick={toggleChat}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}

        {/* Online indicator */}
        {!isOpen && (
          <div
            className={cn(
              "absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white",
              isOnline ? "bg-green-500" : "bg-red-500",
            )}
          />
        )}

        {/* New message indicator */}
        {!isOpen && hasNewMessages && (
          <div className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </Button>
    </div>
  )
}

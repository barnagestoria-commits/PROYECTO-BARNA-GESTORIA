"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WhatsAppTemplates } from "./whatsapp-templates"
import { MessageCircle, Send, Clock, CheckCircle, AlertCircle, TrendingUp, FileText } from "lucide-react"

interface WhatsAppStats {
  totalMessages: number
  templatesUsed: number
  responseRate: number
  avgResponseTime: string
}

interface WhatsAppMessage {
  id: string
  clientName: string
  templateName: string
  status: "sent" | "delivered" | "read" | "replied"
  timestamp: Date
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION"
}

export function WhatsAppAdmin() {
  const [stats] = useState<WhatsAppStats>({
    totalMessages: 156,
    templatesUsed: 8,
    responseRate: 87,
    avgResponseTime: "12 min",
  })

  const [messages] = useState<WhatsAppMessage[]>([
    {
      id: "1",
      clientName: "Juan Pérez",
      templateName: "cita_confirmacion",
      status: "replied",
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      category: "UTILITY",
    },
    {
      id: "2",
      clientName: "María García",
      templateName: "documento_recibido",
      status: "read",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      category: "UTILITY",
    },
    {
      id: "3",
      clientName: "Carlos López",
      templateName: "recordatorio_vencimiento",
      status: "delivered",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      category: "UTILITY",
    },
    {
      id: "4",
      clientName: "Ana Martín",
      templateName: "promocion_servicios",
      status: "sent",
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      category: "MARKETING",
    },
  ])

  const getStatusIcon = (status: WhatsAppMessage["status"]) => {
    switch (status) {
      case "sent":
        return <Clock className="h-4 w-4 text-gray-500" />
      case "delivered":
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      case "read":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "replied":
        return <MessageCircle className="h-4 w-4 text-emerald-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusLabel = (status: WhatsAppMessage["status"]) => {
    switch (status) {
      case "sent":
        return "Enviado"
      case "delivered":
        return "Entregado"
      case "read":
        return "Leído"
      case "replied":
        return "Respondido"
      default:
        return "Error"
    }
  }

  const getCategoryColor = (category: WhatsAppMessage["category"]) => {
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

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return "Ahora"
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensajes Enviados</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages}</div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates Activos</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.templatesUsed}</div>
            <p className="text-xs text-muted-foreground">Aprobados por WhatsApp</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Respuesta</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.responseRate}%</div>
            <p className="text-xs text-muted-foreground">Clientes que responden</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Respuesta</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.avgResponseTime}</div>
            <p className="text-xs text-muted-foreground">Promedio</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates">Gestión de Templates</TabsTrigger>
          <TabsTrigger value="messages">Historial de Mensajes</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <WhatsAppTemplates />
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Mensajes WhatsApp</CardTitle>
              <CardDescription>Seguimiento de todos los templates enviados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <MessageCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{message.clientName}</p>
                          <Badge className={getCategoryColor(message.category)}>{message.category}</Badge>
                        </div>
                        <p className="text-sm text-gray-600">Template: {message.templateName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(message.status)}
                          <span className="text-sm font-medium">{getStatusLabel(message.status)}</span>
                        </div>
                        <p className="text-xs text-gray-500">{formatTime(message.timestamp)}</p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-600 text-green-700 hover:bg-green-50 bg-transparent"
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Reenviar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

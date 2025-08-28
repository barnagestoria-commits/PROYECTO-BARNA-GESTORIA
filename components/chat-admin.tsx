"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MessageCircle, Users, Clock, TrendingUp, Send, User } from "lucide-react"

interface ChatStats {
  totalChats: number
  activeChats: number
  avgResponseTime: string
  satisfactionRate: number
}

interface ChatSession {
  id: string
  userName: string
  lastMessage: string
  timestamp: Date
  status: "active" | "waiting" | "closed"
  unreadCount: number
}

export function ChatAdmin() {
  const [stats] = useState<ChatStats>({
    totalChats: 47,
    activeChats: 3,
    avgResponseTime: "2.5 min",
    satisfactionRate: 94,
  })

  const [chatSessions] = useState<ChatSession[]>([
    {
      id: "1",
      userName: "María García",
      lastMessage: "¿Podrían ayudarme con la declaración de IVA?",
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      status: "waiting",
      unreadCount: 2,
    },
    {
      id: "2",
      userName: "Juan Pérez",
      lastMessage: "Gracias por la información sobre nóminas",
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      status: "active",
      unreadCount: 0,
    },
    {
      id: "3",
      userName: "Ana López",
      lastMessage: "¿Cuánto cuesta constituir una SL?",
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      status: "waiting",
      unreadCount: 1,
    },
  ])

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
            <CardTitle className="text-sm font-medium">Chats Totales</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalChats}</div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chats Activos</CardTitle>
            <Users className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.activeChats}</div>
            <p className="text-xs text-muted-foreground">En este momento</p>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfacción</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.satisfactionRate}%</div>
            <p className="text-xs text-muted-foreground">Valoración positiva</p>
          </CardContent>
        </Card>
      </div>

      {/* Chat Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Conversaciones Activas</CardTitle>
          <CardDescription>Gestiona las consultas de los clientes en tiempo real</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {chatSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{session.userName}</p>
                      <Badge
                        variant={
                          session.status === "active"
                            ? "default"
                            : session.status === "waiting"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {session.status === "active"
                          ? "Activo"
                          : session.status === "waiting"
                            ? "Esperando"
                            : "Cerrado"}
                      </Badge>
                      {session.unreadCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {session.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate max-w-md">{session.lastMessage}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">{formatTime(session.timestamp)}</span>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={session.status === "closed"}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Responder
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Responses */}
      <Card>
        <CardHeader>
          <CardTitle>Respuestas Rápidas</CardTitle>
          <CardDescription>Plantillas para respuestas frecuentes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Servicios</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="cursor-pointer hover:bg-emerald-50">
                  Información contabilidad
                </Badge>
                <Badge variant="outline" className="cursor-pointer hover:bg-emerald-50">
                  Asesoría fiscal
                </Badge>
                <Badge variant="outline" className="cursor-pointer hover:bg-emerald-50">
                  Gestión laboral
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Contacto</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="cursor-pointer hover:bg-emerald-50">
                  Datos de contacto
                </Badge>
                <Badge variant="outline" className="cursor-pointer hover:bg-emerald-50">
                  Horarios
                </Badge>
                <Badge variant="outline" className="cursor-pointer hover:bg-emerald-50">
                  Cita previa
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

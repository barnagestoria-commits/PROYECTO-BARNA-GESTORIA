"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Download,
  FileText,
  Receipt,
  CreditCard,
  LogOut,
  Users,
  Search,
  Filter,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  MessageCircle,
} from "lucide-react"
import { ChatAdmin } from "@/components/chat-admin"
import { WhatsAppAdmin } from "@/components/whatsapp-admin"
import { ResponsiveLogo } from "@/components/responsive-logo"

interface Client {
  id: string
  name: string
  email: string
  company: string
  documentsCount: number
  lastActivity: string
}

interface AdminDocument {
  id: string
  clientName: string
  clientEmail: string
  fileName: string
  type: "factura-recibida" | "factura-emitida" | "extracto-bancario"
  uploadDate: string
  status: "pendiente" | "procesado"
  size: string
}

export default function AdminPage() {
  const [clients] = useState<Client[]>([
    {
      id: "1",
      name: "Juan Pérez",
      email: "juan@empresa.com",
      company: "Empresa ABC SL",
      documentsCount: 15,
      lastActivity: "2024-01-15",
    },
    {
      id: "2",
      name: "María García",
      email: "maria@comercio.com",
      company: "Comercio XYZ",
      documentsCount: 8,
      lastActivity: "2024-01-14",
    },
    {
      id: "3",
      name: "Carlos López",
      email: "carlos@servicios.com",
      company: "Servicios 123 SL",
      documentsCount: 22,
      lastActivity: "2024-01-13",
    },
  ])

  const [documents] = useState<AdminDocument[]>([
    {
      id: "1",
      clientName: "Juan Pérez",
      clientEmail: "juan@empresa.com",
      fileName: "Factura_Proveedor_001.pdf",
      type: "factura-recibida",
      uploadDate: "2024-01-15",
      status: "procesado",
      size: "245 KB",
    },
    {
      id: "2",
      clientName: "María García",
      clientEmail: "maria@comercio.com",
      fileName: "Factura_Cliente_002.pdf",
      type: "factura-emitida",
      uploadDate: "2024-01-14",
      status: "pendiente",
      size: "189 KB",
    },
    {
      id: "3",
      clientName: "Carlos López",
      clientEmail: "carlos@servicios.com",
      fileName: "Extracto_Enero_2024.pdf",
      type: "extracto-bancario",
      uploadDate: "2024-01-13",
      status: "procesado",
      size: "1.2 MB",
    },
  ])

  const [searchTerm, setSearchTerm] = useState("")

  const getTypeLabel = (type: AdminDocument["type"]) => {
    switch (type) {
      case "factura-recibida":
        return "Factura Recibida"
      case "factura-emitida":
        return "Factura Emitida"
      case "extracto-bancario":
        return "Extracto Bancario"
    }
  }

  const getTypeIcon = (type: AdminDocument["type"]) => {
    switch (type) {
      case "factura-recibida":
        return <Receipt className="h-4 w-4" />
      case "factura-emitida":
        return <FileText className="h-4 w-4" />
      case "extracto-bancario":
        return <CreditCard className="h-4 w-4" />
    }
  }

  const handleDownload = (documentId: string) => {
    console.log(`Descargando documento ${documentId}`)
  }

  const handleMarkAsProcessed = (documentId: string) => {
    console.log(`Marcando documento ${documentId} como procesado`)
  }

  const filteredDocuments = documents.filter(
    (doc) =>
      doc.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.clientEmail.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const totalDocuments = documents.length
  const processedDocuments = documents.filter((d) => d.status === "procesado").length
  const pendingDocuments = documents.filter((d) => d.status === "pendiente").length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <ResponsiveLogo size="sm" />
            <h1 className="text-lg md:text-2xl font-bold text-emerald-800">
              <span className="hidden lg:inline">Panel Administrativo - Barna Gestoría</span>
              <span className="hidden sm:inline lg:hidden">Panel Admin</span>
              <span className="sm:hidden">Admin</span>
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 bg-transparent"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
              <p className="text-xs text-muted-foreground">Activos</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Documentos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDocuments}</div>
              <p className="text-xs text-muted-foreground">Este mes</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Procesados</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{processedDocuments}</div>
              <p className="text-xs text-muted-foreground">Completados</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{pendingDocuments}</div>
              <p className="text-xs text-muted-foreground">Por procesar</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="documents" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="chat">
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="whatsapp">
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents">
            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gestión de Documentos</CardTitle>
                    <CardDescription>Todos los documentos subidos por los clientes</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 bg-transparent"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Filtrar
                    </Button>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                      <Download className="h-4 w-4 mr-2" />
                      Descargar Todo
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por cliente, archivo o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        {getTypeIcon(doc.type)}
                        <div>
                          <p className="font-medium">{doc.fileName}</p>
                          <p className="text-sm text-gray-500">
                            {doc.clientName} • {doc.clientEmail}
                          </p>
                          <p className="text-xs text-gray-400">
                            {getTypeLabel(doc.type)} • {doc.size}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            <Calendar className="h-4 w-4 inline mr-1" />
                            {new Date(doc.uploadDate).toLocaleDateString("es-ES")}
                          </p>
                          <Badge variant={doc.status === "procesado" ? "default" : "secondary"}>
                            {doc.status === "procesado" ? "Procesado" : "Pendiente"}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(doc.id)}
                            className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 bg-transparent"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {doc.status === "pendiente" && (
                            <Button
                              size="sm"
                              onClick={() => handleMarkAsProcessed(doc.id)}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clients">
            <Card className="relative overflow-hidden">
              <CardHeader>
                <CardTitle>Gestión de Clientes</CardTitle>
                <CardDescription>Lista de todos los clientes registrados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {clients.map((client) => (
                    <div key={client.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <p className="text-sm text-gray-500">{client.email}</p>
                          <p className="text-xs text-gray-400">{client.company}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{client.documentsCount} documentos</p>
                        <p className="text-sm text-gray-500">
                          Última actividad: {new Date(client.lastActivity).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat">
            <ChatAdmin />
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsAppAdmin />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

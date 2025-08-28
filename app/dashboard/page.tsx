"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { FileText, Receipt, CreditCard, LogOut, Calendar, CheckCircle, Clock } from "lucide-react"
import { FileUpload } from "@/components/file-upload"
import { ResponsiveLogo } from "@/components/responsive-logo"

interface Document {
  id: string
  name: string
  type: "factura-recibida" | "factura-emitida" | "extracto-bancario"
  date: string
  status: "pendiente" | "procesado"
  size: string
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: "1",
      name: "Factura_Proveedor_001.pdf",
      type: "factura-recibida",
      date: "2024-01-15",
      status: "procesado",
      size: "245 KB",
    },
    {
      id: "2",
      name: "Factura_Cliente_002.pdf",
      type: "factura-emitida",
      date: "2024-01-14",
      status: "pendiente",
      size: "189 KB",
    },
    {
      id: "3",
      name: "Extracto_Enero_2024.pdf",
      type: "extracto-bancario",
      date: "2024-01-31",
      status: "procesado",
      size: "1.2 MB",
    },
  ])

  const getTypeLabel = (type: Document["type"]) => {
    switch (type) {
      case "factura-recibida":
        return "Factura Recibida"
      case "factura-emitida":
        return "Factura Emitida"
      case "extracto-bancario":
        return "Extracto Bancario"
    }
  }

  const getTypeIcon = (type: Document["type"]) => {
    switch (type) {
      case "factura-recibida":
        return <Receipt className="h-4 w-4" />
      case "factura-emitida":
        return <FileText className="h-4 w-4" />
      case "extracto-bancario":
        return <CreditCard className="h-4 w-4" />
    }
  }

  const handleFileUpload = (files: File[], type: Document["type"]) => {
    const newDocuments = files.map((file) => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: file.name,
      type,
      date: new Date().toISOString().split("T")[0],
      status: "pendiente" as const,
      size: `${Math.round(file.size / 1024)} KB`,
    }))

    setDocuments((prev) => [...prev, ...newDocuments])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <ResponsiveLogo size="sm" />
            <h1 className="text-lg md:text-2xl font-bold text-emerald-800">
              <span className="hidden lg:inline">Panel Cliente - Barna Gestoría</span>
              <span className="hidden sm:inline lg:hidden">Panel Cliente</span>
              <span className="sm:hidden">Panel</span>
            </h1>
          </div>
          <Button variant="outline" size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Documentos Subidos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documents.length}</div>
              <p className="text-xs text-muted-foreground">Este mes</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Procesados</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-700" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700">
                {documents.filter((d) => d.status === "procesado").length}
              </div>
              <p className="text-xs text-muted-foreground">Completados</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {documents.filter((d) => d.status === "pendiente").length}
              </div>
              <p className="text-xs text-muted-foreground">En proceso</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upload">Subir Documentos</TabsTrigger>
            <TabsTrigger value="documents">Mis Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-emerald-600" />
                    Facturas Recibidas
                  </CardTitle>
                  <CardDescription>Facturas de proveedores y gastos de la empresa</CardDescription>
                </CardHeader>
                <CardContent>
                  <FileUpload
                    onFilesSelected={(files) => handleFileUpload(files, "factura-recibida")}
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-600" />
                    Facturas Emitidas
                  </CardTitle>
                  <CardDescription>Facturas enviadas a tus clientes</CardDescription>
                </CardHeader>
                <CardContent>
                  <FileUpload
                    onFilesSelected={(files) => handleFileUpload(files, "factura-emitida")}
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-emerald-700" />
                    Extractos Bancarios
                  </CardTitle>
                  <CardDescription>Movimientos bancarios mensuales</CardDescription>
                </CardHeader>
                <CardContent>
                  <FileUpload
                    onFilesSelected={(files) => handleFileUpload(files, "extracto-bancario")}
                    accept=".pdf,.csv,.xls,.xlsx"
                    multiple
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Documentos Subidos</CardTitle>
                <CardDescription>Historial de todos tus documentos fiscales</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(doc.type)}
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-gray-500">
                            {getTypeLabel(doc.type)} • {doc.size}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            <Calendar className="h-4 w-4 inline mr-1" />
                            {new Date(doc.date).toLocaleDateString("es-ES")}
                          </p>
                        </div>
                        <Badge variant={doc.status === "procesado" ? "default" : "secondary"}>
                          {doc.status === "procesado" ? "Procesado" : "Pendiente"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

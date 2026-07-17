"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Receipt,
  CreditCard,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  ScanLine,
} from "lucide-react"
import { FileUpload } from "@/components/file-upload"
import { InvoiceValidationForm } from "@/components/invoice-validation-form"
import { TaxSummaryPanel } from "@/components/tax-summary-panel"
import { useRequireAuth } from "@/components/auth-provider"
import type { InvoiceOcrResult } from "@/lib/types/invoice"
import { apiFetch, apiFormFetch } from "@/lib/api-client"

interface Document {
  id: string
  companyId: string
  name: string
  type: "factura-recibida" | "factura-emitida" | "extracto-bancario"
  date: string
  status: "pendiente" | "procesado"
  size: string
  ocrData?: InvoiceOcrResult
}

interface PendingValidation {
  file: File
  fileName: string
  ocrData: InvoiceOcrResult
}

export default function DashboardPage() {
  const { session, panelTitle, activeCompany } = useRequireAuth()

  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [isProcessingOcr, setIsProcessingOcr] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [pendingValidation, setPendingValidation] = useState<PendingValidation | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [validationQueue, setValidationQueue] = useState<File[]>([])

  const loadDocuments = useCallback(async () => {
    if (!session?.activeCompanyId) return

    setIsLoadingDocs(true)
    try {
      const data = await apiFetch<{ success: true; documents: Document[] }>("/api/documents")
      setDocuments(data.documents)
    } catch {
      setDocuments([])
    } finally {
      setIsLoadingDocs(false)
    }
  }, [session?.activeCompanyId])

  useEffect(() => {
    if (session?.activeCompanyId) {
      loadDocuments()
    }
  }, [session?.activeCompanyId, loadDocuments])

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

  const saveDocument = async (
    file: File,
    type: Document["type"],
    ocrData?: InvoiceOcrResult,
  ) => {
    if (!session?.activeCompanyId) return

    await apiFetch("/api/documents", {
      method: "POST",
      body: JSON.stringify({
        companyId: session.activeCompanyId,
        name: file.name,
        type,
        status: ocrData ? "procesado" : "pendiente",
        sizeBytes: file.size,
        ocrData,
      }),
    })

    await loadDocuments()
  }

  const processInvoiceOcr = async (file: File): Promise<InvoiceOcrResult> => {
    if (!session?.activeCompanyId) {
      throw new Error("Selecciona una empresa antes de subir facturas.")
    }

    const formData = new FormData()
    formData.append("file", file)
    formData.append("companyId", session.activeCompanyId)

    const result = await apiFormFetch<{ success: true; data: InvoiceOcrResult }>(
      "/api/invoices/ocr",
      formData,
    )

    return result.data
  }

  const processNextInQueue = async (queue: File[]) => {
    if (queue.length === 0) return

    const [currentFile, ...remaining] = queue
    setValidationQueue(remaining)
    setIsProcessingOcr(true)
    setOcrError(null)

    try {
      const ocrData = await processInvoiceOcr(currentFile)
      setPendingValidation({
        file: currentFile,
        fileName: currentFile.name,
        ocrData,
      })
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : "Error al procesar la factura.")
      if (remaining.length > 0) {
        await processNextInQueue(remaining)
      }
    } finally {
      setIsProcessingOcr(false)
    }
  }

  const handleFileUpload = async (files: File[], type: Document["type"]) => {
    if (!session?.activeCompanyId) {
      setOcrError("No hay empresa activa. Contacta con tu gestoría si el problema persiste.")
      return
    }

    if (type === "factura-recibida") {
      await processNextInQueue(files)
      return
    }

    for (const file of files) {
      await saveDocument(file, type)
    }
  }

  const handleConfirmValidation = async (data: InvoiceOcrResult) => {
    if (!pendingValidation) return

    setIsConfirming(true)
    setOcrError(null)

    try {
      const result = await apiFetch<{
        success: true
        accounting: {
          entryId: string
          commandCode: string
          thirdParty: {
            formattedAccountCode: string
            isNew: boolean
          }
        }
      }>("/api/invoices/confirm", {
        method: "POST",
        body: JSON.stringify({
          fileName: pendingValidation.fileName,
          sizeBytes: pendingValidation.file.size,
          documentType: "factura-recibida",
          invoice: data,
        }),
      })

      const actionLabel = result.accounting.thirdParty.isNew ? "creada" : "reutilizada"
      setImportMessage(
        `Factura contabilizada: asiento ${result.accounting.commandCode} con cuenta ${result.accounting.thirdParty.formattedAccountCode} (${actionLabel}).`,
      )
      await loadDocuments()
      setPendingValidation(null)

      if (validationQueue.length > 0) {
        await processNextInQueue(validationQueue)
      }
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : "Error al confirmar la factura.")
    } finally {
      setIsConfirming(false)
    }
  }

  const handleCancelValidation = async () => {
    setPendingValidation(null)

    if (validationQueue.length > 0) {
      await processNextInQueue(validationQueue)
    }
  }

  if (!session) {
    return null
  }

  const noCompany = session.companies.length === 0

  return (
    <>
        {noCompany ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-600">
              {session.user.accountType === "GESTORIA" ? (
                <p>Tu gestoría aún no tiene empresas clientes asignadas.</p>
              ) : (
                <p>No se encontró empresa vinculada a tu cuenta.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {activeCompany && session.canSwitchCompanies && (
              <p className="mb-4 text-sm text-gray-600">
                Gestionando documentación de{" "}
                <span className="font-medium text-emerald-800">{activeCompany.name}</span>
              </p>
            )}

            <TaxSummaryPanel companyId={session.activeCompanyId} />

            <div className="mb-8 mt-6 grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Documentos Subidos</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{documents.length}</div>
                  <p className="text-xs text-muted-foreground">Empresa activa</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Procesados</CardTitle>
                  <CheckCircle className="h-4 w-4 text-emerald-700" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-700">
                    {documents.filter((d) => d.status === "procesado").length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                  <Clock className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    {documents.filter((d) => d.status === "pendiente").length}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="upload" className="space-y-6">
              <TabsList>
                <TabsTrigger value="upload">Subir Documentos</TabsTrigger>
                <TabsTrigger value="documents">Mis Documentos</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-6">
                {isProcessingOcr && (
                  <Card className="border-emerald-200 bg-emerald-50">
                    <CardContent className="flex items-center gap-3 py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
                      <div>
                        <p className="font-medium text-emerald-800">Analizando factura con IA...</p>
                        <p className="text-sm text-emerald-700">
                          Procesando para {activeCompany?.name}. Puede tardar unos segundos.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {ocrError && (
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="py-4">
                      <p className="text-sm text-red-700">{ocrError}</p>
                    </CardContent>
                  </Card>
                )}

                {pendingValidation && (
                  <InvoiceValidationForm
                    fileName={pendingValidation.fileName}
                    initialData={pendingValidation.ocrData}
                    onConfirm={handleConfirmValidation}
                    onCancel={handleCancelValidation}
                    isSubmitting={isConfirming}
                  />
                )}

                {importMessage && (
                  <Card className="border-emerald-200 bg-emerald-50">
                    <CardContent className="py-4">
                      <p className="text-sm text-emerald-800">{importMessage}</p>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-emerald-200 overflow-hidden">
                  <CardHeader className="px-4 sm:px-6">
                    <CardTitle className="text-lg sm:text-xl leading-snug break-words text-balance">
                      Centro de subida de documentos
                    </CardTitle>
                    <CardDescription className="break-words text-pretty leading-relaxed">
                      Selecciona el tipo de documento y elige cámara, archivo o importación contable.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 overflow-x-hidden">
                    <FileUpload
                      onFilesSelected={(files, type) => handleFileUpload(files, type)}
                      onAccountingImport={(result) => {
                        setImportMessage(
                          `Importación completada (${result.format.toUpperCase()}): ${result.rowsImported} líneas → ${result.entriesCreated} asientos en el diario.`,
                        )
                        setOcrError(null)
                      }}
                      onImportError={(message) => {
                        setImportMessage(null)
                        setOcrError(message)
                      }}
                      disabled={isProcessingOcr || !!pendingValidation}
                      cameraTourId="scan-invoice"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents">
                <Card>
                  <CardHeader>
                    <CardTitle>Documentos de {activeCompany?.name}</CardTitle>
                    <CardDescription>
                      OCR y extractos vinculados al ID de empresa{" "}
                      <code className="text-xs">{session.activeCompanyId}</code>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingDocs ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
                      </div>
                    ) : documents.length === 0 ? (
                      <p className="py-8 text-center text-gray-500">No hay documentos para esta empresa.</p>
                    ) : (
                      <div className="space-y-4">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              {getTypeIcon(doc.type)}
                              <div>
                                <p className="font-medium">{doc.name}</p>
                                <p className="text-sm text-gray-500">
                                  {getTypeLabel(doc.type)} • {doc.size}
                                </p>
                                {doc.ocrData && (
                                  <p className="mt-1 text-xs text-emerald-700">
                                    <ScanLine className="mr-1 inline h-3 w-3" />
                                    {doc.ocrData.proveedor} • {doc.ocrData.cif}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="text-sm text-gray-500">
                                <Calendar className="h-4 w-4 inline mr-1" />
                                {new Date(doc.date).toLocaleDateString("es-ES")}
                              </p>
                              <Badge variant={doc.status === "procesado" ? "default" : "secondary"}>
                                {doc.status === "procesado" ? "Procesado" : "Pendiente"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
    </>
  )
}

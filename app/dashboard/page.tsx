"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Receipt,
  CreditCard,
  Calendar,
  Loader2,
  ScanLine,
} from "lucide-react"
import { FileUpload, type UploadDocumentType } from "@/components/file-upload"
import { InvoiceValidationForm } from "@/components/invoice-validation-form"
import { TaxSummaryPanel } from "@/components/tax-summary-panel"
import { FinancialAnalyticsDashboard } from "@/components/dashboard/financial-analytics-dashboard"
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

function DashboardPageContent() {
  const { session, panelTitle, activeCompany } = useRequireAuth()
  const searchParams = useSearchParams()
  const uploadSectionRef = useRef<HTMLDivElement>(null)

  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [isProcessingOcr, setIsProcessingOcr] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [pendingValidation, setPendingValidation] = useState<PendingValidation | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [validationQueue, setValidationQueue] = useState<File[]>([])

  const initialDocumentType = useMemo<UploadDocumentType>(() => {
    const actionMap: Record<string, UploadDocumentType> = {
      "subir-factura-recibida": "factura-recibida",
      "subir-factura-emitida": "factura-emitida",
      "subir-extracto": "extracto-bancario",
    }
    return actionMap[searchParams.get("accion") ?? ""] ?? "factura-recibida"
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get("accion")) {
      uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [searchParams])

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
            <FinancialAnalyticsDashboard
              userName={session.user.name}
              companyName={activeCompany?.name}
              onUploadClick={() => {
                uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
              }}
            />

            <div className="my-8 border-t border-sand-200" />

            <TaxSummaryPanel companyId={session.activeCompanyId} />

            <div ref={uploadSectionRef} className="mt-8">
            <Tabs defaultValue="upload" className="space-y-6">
              <TabsList className="flex h-auto w-full flex-col gap-1 p-1 sm:inline-flex sm:h-10 sm:w-auto sm:flex-row">
                <TabsTrigger value="upload" className="w-full sm:w-auto">
                  Subir Documentos
                </TabsTrigger>
                <TabsTrigger value="documents" className="w-full sm:w-auto">
                  Mis Documentos
                </TabsTrigger>
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

                <Card className="border-emerald-200 overflow-hidden" ref={uploadSectionRef}>
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
                      initialDocumentType={initialDocumentType}
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
                            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 items-start gap-3">
                              {getTypeIcon(doc.type)}
                              <div className="min-w-0">
                                <p className="break-words font-medium">{doc.name}</p>
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
                            <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
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
            </div>
          </>
        )}
    </>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  )
}

"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Calendar, Loader2, ScanLine } from "lucide-react"
import { FileUpload, type UploadDocumentType } from "@/components/file-upload"
import { InvoiceValidationForm } from "@/components/invoice-validation-form"
import { useRequireAuth } from "@/components/auth-provider"
import type { InvoiceOcrResult } from "@/lib/types/invoice"
import { apiFetch, apiFormFetch } from "@/lib/api-client"

interface Document {
  id: string
  companyId: string
  name: string
  type: UploadDocumentType
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

interface DocumentUploadWorkspaceProps {
  documentType: UploadDocumentType
  title: string
  description: string
  cameraTourId?: string
}

const TYPE_LABELS: Record<UploadDocumentType, string> = {
  "factura-recibida": "Factura Recibida",
  "factura-emitida": "Factura Emitida",
  "extracto-bancario": "Extracto Bancario",
}

function DocumentUploadWorkspaceContent({
  documentType,
  title,
  description,
  cameraTourId,
}: DocumentUploadWorkspaceProps) {
  const { session, activeCompany } = useRequireAuth()
  const searchParams = useSearchParams()

  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [isProcessingOcr, setIsProcessingOcr] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [pendingValidation, setPendingValidation] = useState<PendingValidation | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [validationQueue, setValidationQueue] = useState<File[]>([])

  const defaultTab = searchParams.get("tab") === "documentos" ? "documents" : "upload"

  const loadDocuments = useCallback(async () => {
    if (!session?.activeCompanyId) return

    setIsLoadingDocs(true)
    try {
      const data = await apiFetch<{ success: true; documents: Document[] }>("/api/documents")
      setDocuments(data.documents.filter((doc) => doc.type === documentType))
    } catch {
      setDocuments([])
    } finally {
      setIsLoadingDocs(false)
    }
  }, [session?.activeCompanyId, documentType])

  useEffect(() => {
    if (session?.activeCompanyId) {
      loadDocuments()
    }
  }, [session?.activeCompanyId, loadDocuments])

  const saveDocument = async (file: File, type: UploadDocumentType, ocrData?: InvoiceOcrResult) => {
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

  const handleFileUpload = async (files: File[], type: UploadDocumentType) => {
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

  if (noCompany) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-gray-600">
          {session.user.accountType === "GESTORIA" ? (
            <p>Tu gestoría aún no tiene empresas clientes asignadas.</p>
          ) : (
            <p>No se encontró empresa vinculada a tu cuenta.</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Tabs defaultValue={defaultTab} className="space-y-6">
      <TabsList className="flex h-auto w-full flex-col gap-1 p-1 sm:inline-flex sm:h-10 sm:w-auto sm:flex-row">
        <TabsTrigger value="upload" className="w-full sm:w-auto">
          Subir documentos
        </TabsTrigger>
        <TabsTrigger value="documents" className="w-full sm:w-auto">
          Mis documentos
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

        <Card className="overflow-hidden border-emerald-200">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-lg leading-snug break-words text-balance sm:text-xl">
              {title}
            </CardTitle>
            <CardDescription className="break-words text-pretty leading-relaxed">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-hidden px-4 pb-4 sm:px-6 sm:pb-6">
            <FileUpload
              fixedDocumentType={documentType}
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
              cameraTourId={cameraTourId}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="documents">
        <Card>
          <CardHeader>
            <CardTitle>{TYPE_LABELS[documentType]} — {activeCompany?.name}</CardTitle>
            <CardDescription>
              Documentos vinculados al ID de empresa{" "}
              <code className="text-xs">{session.activeCompanyId}</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingDocs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
              </div>
            ) : documents.length === 0 ? (
              <p className="py-8 text-center text-gray-500">
                No hay documentos de este tipo para esta empresa.
              </p>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{doc.name}</p>
                        <p className="text-sm text-gray-500">
                          {TYPE_LABELS[doc.type]} • {doc.size}
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
                        <Calendar className="mr-1 inline h-4 w-4" />
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
  )
}

export function DocumentUploadWorkspace(props: DocumentUploadWorkspaceProps) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
        </div>
      }
    >
      <DocumentUploadWorkspaceContent {...props} />
    </Suspense>
  )
}

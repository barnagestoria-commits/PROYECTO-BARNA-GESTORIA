"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Calendar, CheckCircle2, Loader2, ScanLine, Settings2, Trash2 } from "lucide-react"
import { FileUpload, type UploadDocumentType } from "@/components/file-upload"
import { InvoiceValidationForm } from "@/components/invoice-validation-form"
import { OcrSettingsDialog } from "@/components/documents/ocr-settings-dialog"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { useRequireAuth } from "@/components/auth-provider"
import type { InvoiceOcrResult } from "@/lib/types/invoice"
import { apiFetch, apiFormFetch } from "@/lib/api-client"
import {
  DEFAULT_OCR_SETTINGS,
  parseOcrSettings,
  type OcrWorkspaceSettings,
} from "@/lib/ocr/ocr-settings"

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
  remainingInvoices: InvoiceOcrResult[]
  invoiceIndex: number
  invoiceCount: number
}

interface CounterpartPreferencePrompt {
  thirdPartyAccountCode: string
  thirdPartyName: string
  counterpartAccount: string
  kind: "purchase" | "sale"
  confirmed: boolean
  error: string | null
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
  const [sessionDocumentIds, setSessionDocumentIds] = useState<string[]>([])
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

  const [ocrSettings, setOcrSettings] = useState<OcrWorkspaceSettings>(DEFAULT_OCR_SETTINGS)
  const [ocrSettingsOpen, setOcrSettingsOpen] = useState(false)
  const [savingOcrSetting, setSavingOcrSetting] = useState(false)
  const [counterpartPrompt, setCounterpartPrompt] =
    useState<CounterpartPreferencePrompt | null>(null)
  const [savingCounterpart, setSavingCounterpart] = useState(false)

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
      void apiFetch<{
        success: true
        settings: { ocrBlockDuplicates?: boolean; ocrSettingsJson?: string | null }
      }>("/api/accounting/analytic-settings")
        .then((data) =>
          setOcrSettings(parseOcrSettings(data.settings.ocrSettingsJson, data.settings.ocrBlockDuplicates ?? true)),
        )
        .catch(() => setOcrSettings(DEFAULT_OCR_SETTINGS))
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

  const processInvoiceOcr = async (file: File): Promise<InvoiceOcrResult[]> => {
    if (!session?.activeCompanyId) {
      throw new Error("Selecciona una empresa antes de subir facturas.")
    }

    const formData = new FormData()
    formData.append("file", file)
    formData.append("companyId", session.activeCompanyId)
    formData.append("documentType", documentType)

    const result = await apiFormFetch<{
      success: true
      data: InvoiceOcrResult
      invoices?: InvoiceOcrResult[]
    }>("/api/invoices/ocr", formData)

    const invoices = result.invoices?.length ? result.invoices : [result.data]
    return invoices
  }

  const processNextInQueue = async (queue: File[]) => {
    if (queue.length === 0) return

    const [currentFile, ...remaining] = queue
    setValidationQueue(remaining)
    setIsProcessingOcr(true)
    setOcrError(null)

    try {
      const invoices = await processInvoiceOcr(currentFile)
      setPendingValidation({
        file: currentFile,
        fileName: currentFile.name,
        ocrData: invoices[0],
        remainingInvoices: invoices.slice(1),
        invoiceIndex: 1,
        invoiceCount: invoices.length,
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

    if (type === "factura-recibida" || type === "factura-emitida") {
      setSessionDocumentIds([])
      await processNextInQueue(files)
      return
    }

    for (const file of files) {
      await saveDocument(file, type)
    }
  }

  const handleSaveOcrSettings = async (next: OcrWorkspaceSettings) => {
    setSavingOcrSetting(true)
    try {
      const data = await apiFetch<{
        success: true
        settings: { ocrBlockDuplicates?: boolean; ocrSettingsJson?: string | null }
      }>("/api/accounting/analytic-settings", {
        method: "PUT",
        body: JSON.stringify({ ocr: next }),
      })
      setOcrSettings(parseOcrSettings(data.settings.ocrSettingsJson, data.settings.ocrBlockDuplicates ?? next.blockDuplicates))
      setOcrSettingsOpen(false)
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : "No se pudo guardar la configuración OCR.")
    } finally {
      setSavingOcrSetting(false)
    }
  }

  const advanceAfterConfirmedInvoice = async () => {
    if (!pendingValidation) return

    if (pendingValidation.remainingInvoices.length > 0) {
      const [nextInvoice, ...rest] = pendingValidation.remainingInvoices
      setPendingValidation({
        ...pendingValidation,
        ocrData: nextInvoice,
        remainingInvoices: rest,
        invoiceIndex: pendingValidation.invoiceIndex + 1,
      })
      return
    }

    setPendingValidation(null)
    if (validationQueue.length > 0) {
      await processNextInQueue(validationQueue)
    }
  }

  const handleConfirmValidation = async (
    data: InvoiceOcrResult,
    options?: { allowDuplicate?: boolean; offerRememberCounterpartAccount?: boolean },
  ) => {
    if (!pendingValidation) return

    setIsConfirming(true)
    setOcrError(null)

    try {
      const result = await apiFetch<{
        success: true
        document: { id: string }
        accounting: {
          entryId: string
          commandCode: string
          thirdParty: {
            accountCode: string
            formattedAccountCode: string
            name: string
            isNew: boolean
          }
        }
      }>("/api/invoices/confirm", {
        method: "POST",
        body: JSON.stringify({
          fileName: pendingValidation.fileName,
          sizeBytes: pendingValidation.file.size,
          documentType,
          invoice: data,
          allowDuplicate: Boolean(options?.allowDuplicate),
        }),
      })

      setSessionDocumentIds((prev) => [...prev, result.document.id])
      const actionLabel = result.accounting.thirdParty.isNew ? "creada" : "reutilizada"
      setImportMessage(
        `Factura contabilizada: asiento ${result.accounting.commandCode} con cuenta ${result.accounting.thirdParty.formattedAccountCode} (${actionLabel}).`,
      )
      await loadDocuments()

      const counterpartAccount =
        documentType === "factura-emitida" ? data.incomeAccount?.trim() : data.expenseAccount?.trim()
      if (options?.offerRememberCounterpartAccount && counterpartAccount) {
        setCounterpartPrompt({
          thirdPartyAccountCode: result.accounting.thirdParty.accountCode,
          thirdPartyName: result.accounting.thirdParty.name || data.proveedor,
          counterpartAccount,
          kind: documentType === "factura-emitida" ? "sale" : "purchase",
          confirmed: false,
          error: null,
        })
        return
      }

      await advanceAfterConfirmedInvoice()
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : "Error al confirmar la factura.")
    } finally {
      setIsConfirming(false)
    }
  }

  const continueAfterCounterpartPrompt = async () => {
    setCounterpartPrompt(null)
    await advanceAfterConfirmedInvoice()
  }

  const handleSaveCounterpartPreference = async () => {
    if (!counterpartPrompt) return

    setSavingCounterpart(true)
    setCounterpartPrompt((current) => (current ? { ...current, error: null } : current))
    try {
      await apiFetch("/api/accounting/account-treatment", {
        method: "PATCH",
        body: JSON.stringify({
          accountCode: counterpartPrompt.thirdPartyAccountCode,
          defaultCounterpartAccount: counterpartPrompt.counterpartAccount,
        }),
      })
      setCounterpartPrompt((current) => (current ? { ...current, confirmed: true } : current))
    } catch (error) {
      setCounterpartPrompt((current) =>
        current
          ? {
              ...current,
              error:
                error instanceof Error
                  ? error.message
                  : "No se pudo guardar la cuenta predefinida.",
            }
          : current,
      )
    } finally {
      setSavingCounterpart(false)
    }
  }

  const handleSkipInvoice = () => {
    if (!pendingValidation) return

    if (pendingValidation.remainingInvoices.length > 0) {
      const [nextInvoice, ...rest] = pendingValidation.remainingInvoices
      setPendingValidation({
        ...pendingValidation,
        ocrData: nextInvoice,
        remainingInvoices: rest,
        invoiceIndex: pendingValidation.invoiceIndex + 1,
      })
      return
    }

    setPendingValidation(null)
  }

  const handleDiscardBatch = async () => {
    const confirmedCount = sessionDocumentIds.length
    const pendingCount =
      (pendingValidation ? 1 + pendingValidation.remainingInvoices.length : 0) + validationQueue.length

    if (confirmedCount > 0) {
      const confirmed = window.confirm(
        `Este lote tiene ${confirmedCount} factura(s) ya confirmada(s). Se eliminarán esos documentos y sus asientos. ¿Descartar todo?`,
      )
      if (!confirmed) return

      setIsConfirming(true)
      try {
        for (const id of sessionDocumentIds) {
          await apiFetch(`/api/documents/${id}`, { method: "DELETE" })
        }
      } catch (error) {
        setOcrError(
          error instanceof Error ? error.message : "No se pudieron eliminar las facturas confirmadas del lote.",
        )
        setIsConfirming(false)
        return
      }
      setIsConfirming(false)
    } else if (pendingCount > 1) {
      const confirmed = window.confirm(
        "¿Descartar todas las facturas reconocidas de este lote? Todavía no se ha creado ninguna cuenta ni asiento.",
      )
      if (!confirmed) return
    }

    setPendingValidation(null)
    setValidationQueue([])
    setSessionDocumentIds([])
    setOcrError(null)
    setImportMessage(
      "Lote OCR descartado. No queda nada contabilizado de esta prueba. Ya puedes volver a subir el mismo PDF.",
    )
    await loadDocuments()
  }

  const handleDeleteDocument = async (doc: Document) => {
    if (
      !window.confirm(
        `¿Eliminar ${doc.name}? Se borrará el documento y, si estaba contabilizado, su asiento.`,
      )
    ) {
      return
    }

    setDeletingDocId(doc.id)
    setOcrError(null)
    try {
      await apiFetch(`/api/documents/${doc.id}`, { method: "DELETE" })
      setSessionDocumentIds((prev) => prev.filter((id) => id !== doc.id))
      await loadDocuments()
      setImportMessage("Documento eliminado. Si tenía asiento, también se ha borrado.")
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : "No se pudo eliminar el documento.")
    } finally {
      setDeletingDocId(null)
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
    <>
    <Tabs defaultValue={defaultTab} className={pendingValidation ? "space-y-2" : "space-y-6"}>
      {documentType === "factura-emitida" && (
        <Card className="border-emerald-200 bg-emerald-50/60" data-tour="onboarding-verifactu">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-pine-900">Verifactu · Registro inalterable</CardTitle>
            <CardDescription>
              Al emitir facturas, se generará el código QR oficial y la huella de registro para la AEAT.{" "}
              <a href="/configuracion/plantilla-factura" className="font-medium text-emerald-800 underline">
                Configura la plantilla PDF
              </a>{" "}
              o previsualiza antes de enviar.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!pendingValidation ? (
        <TabsList className="flex h-auto w-full flex-col gap-1 p-1 sm:inline-flex sm:h-10 sm:w-auto sm:flex-row">
          <TabsTrigger value="upload" className="w-full sm:w-auto">
            Subir documentos
          </TabsTrigger>
          <TabsTrigger value="documents" className="w-full sm:w-auto">
            Mis documentos
          </TabsTrigger>
        </TabsList>
      ) : null}

      <TabsContent value="upload" className={pendingValidation ? "mt-0 space-y-2" : "space-y-6"}>
        {isProcessingOcr && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="flex items-center gap-3 py-6">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
              <div>
                <p className="font-medium text-emerald-800">Analizando facturas y tickets con IA...</p>
                <p className="text-sm text-emerald-700">
                  Leemos todas las páginas del PDF. Si hay varios tickets, los iremos mostrando uno a uno.
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
            key={`${pendingValidation.fileName}-${pendingValidation.invoiceIndex}`}
            fileName={pendingValidation.fileName}
            file={pendingValidation.file}
            initialData={pendingValidation.ocrData}
            documentType={documentType === "factura-emitida" ? "factura-emitida" : "factura-recibida"}
            remainingCount={pendingValidation.remainingInvoices.length}
            invoiceIndex={pendingValidation.invoiceIndex}
            invoiceCount={pendingValidation.invoiceCount}
            ocrSettings={ocrSettings}
            enableShortcuts={!ocrSettingsOpen && !counterpartPrompt}
            onOpenSettings={() => setOcrSettingsOpen(true)}
            progressLabel={
              pendingValidation.invoiceCount > 1
                ? `Factura ${pendingValidation.invoiceIndex} de ${pendingValidation.invoiceCount}`
                : undefined
            }
            onConfirm={handleConfirmValidation}
            onCancel={() => void handleDiscardBatch()}
            onSkip={handleSkipInvoice}
            isSubmitting={isConfirming || Boolean(counterpartPrompt)}
          />
        )}

        {importMessage && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="py-4">
              <p className="text-sm text-emerald-800">{importMessage}</p>
            </CardContent>
          </Card>
        )}

        {!pendingValidation ? (
        <Card className="overflow-hidden border-emerald-200">
          <CardHeader className="px-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-lg leading-snug break-words text-balance sm:text-xl">
                  {title}
                </CardTitle>
                <CardDescription className="break-words text-pretty leading-relaxed">
                  {description}
                </CardDescription>
                {(documentType === "factura-recibida" || documentType === "factura-emitida") ? (
                  <p className="pt-2 text-xs text-gray-500">
                    Hasta que pulses Confirmar no se crea ninguna cuenta ni asiento. Puedes descartar
                    el lote entero y volver a subir el mismo PDF.
                  </p>
                ) : null}
              </div>
              {(documentType === "factura-recibida" || documentType === "factura-emitida") ? (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setOcrSettingsOpen(true)}
                >
                  <Settings2 className="h-4 w-4" />
                  Configurar OCR
                </Button>
              ) : null}
            </div>
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
        ) : null}
      </TabsContent>

      <TabsContent value="documents">
        <Card>
          <CardHeader>
            <CardTitle>{TYPE_LABELS[documentType]} — {activeCompany?.name}</CardTitle>
            <CardDescription>
              Documentos contabilizados de esta empresa. Eliminar uno borra también su asiento, como
              al deshacer una importación.
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDeleteDocument(doc)}
                        disabled={deletingDocId === doc.id}
                      >
                        {deletingDocId === doc.id ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-1 h-4 w-4" />
                        )}
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
    {(documentType === "factura-recibida" || documentType === "factura-emitida") ? (
      <OcrSettingsDialog
        open={ocrSettingsOpen}
        saving={savingOcrSetting}
        settings={ocrSettings}
        onClose={() => setOcrSettingsOpen(false)}
        onSave={handleSaveOcrSettings}
      />
    ) : null}
    <AccountingModal
      open={counterpartPrompt !== null}
      title={counterpartPrompt?.confirmed ? "Cuenta predefinida guardada" : "Guardar cuenta habitual"}
      subtitle={counterpartPrompt?.thirdPartyName}
      onClose={() => {
        if (!savingCounterpart) void continueAfterCounterpartPrompt()
      }}
      className="max-w-lg"
      footer={
        counterpartPrompt?.confirmed ? (
          <div className="flex justify-end">
            <Button type="button" onClick={() => void continueAfterCounterpartPrompt()}>
              Continuar
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={savingCounterpart}
              onClick={() => void continueAfterCounterpartPrompt()}
            >
              No, solo esta factura
            </Button>
            <Button
              type="button"
              disabled={savingCounterpart}
              onClick={() => void handleSaveCounterpartPreference()}
            >
              {savingCounterpart ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sí, predefinir"}
            </Button>
          </div>
        )
      }
    >
      {counterpartPrompt?.confirmed ? (
        <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm leading-relaxed">
            Confirmado. A partir de ahora, las facturas de este{" "}
            {counterpartPrompt.kind === "purchase" ? "proveedor" : "cliente"} irán siempre a la cuenta
            de {counterpartPrompt.kind === "purchase" ? "gasto" : "ventas"}{" "}
            <strong className="font-mono">{counterpartPrompt.counterpartAccount}</strong>.
          </p>
        </div>
      ) : counterpartPrompt ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-graphite-700">
            ¿Quieres dejar la partida de {counterpartPrompt.kind === "purchase" ? "gasto" : "ventas"}{" "}
            <strong className="font-mono">{counterpartPrompt.counterpartAccount}</strong> predefinida
            para este {counterpartPrompt.kind === "purchase" ? "proveedor" : "cliente"}?
          </p>
          <p className="text-xs text-graphite-500">
            Se aplicará automáticamente a sus próximas facturas y podrás cambiarla manualmente cuando
            sea necesario.
          </p>
          {counterpartPrompt.error ? (
            <p className="text-sm text-red-700" role="alert">
              {counterpartPrompt.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </AccountingModal>
    </>
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

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, KeyRound } from "lucide-react"
import { CertificateStatusCard } from "@/components/settings/certificate-status-card"
import { CertificateUploadForm } from "@/components/settings/certificate-upload-form"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api-client"
import {
  buildMockCertificate,
  loadStoredCertificate,
  saveStoredCertificate,
  type CertificateUploadPayload,
  type StoredDigitalCertificate,
} from "@/lib/settings/certificate-storage"

type Feedback = { tone: "success" | "warning"; message: string }

export function CertificateSettingsPage() {
  const [certificate, setCertificate] = useState<StoredDigitalCertificate | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    setCertificate(loadStoredCertificate())
  }, [])

  const handleSave = async (payload: CertificateUploadPayload) => {
    setIsSaving(true)
    setFeedback(null)
    try {
      await apiFetch<{ success: true; certificate: StoredDigitalCertificate }>(
        "/api/certificate",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      )

      const stored = buildMockCertificate(payload)
      saveStoredCertificate(stored)
      setCertificate(stored)
      setFeedback({
        tone: "success",
        message: "Certificado guardado y encriptado correctamente (demo).",
      })
    } catch (error) {
      setFeedback({
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el certificado. Inténtalo de nuevo.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestSignature = async () => {
    if (!certificate) {
      setFeedback({
        tone: "warning",
        message: "Sube un certificado antes de probar la firma.",
      })
      return
    }

    setIsTesting(true)
    setFeedback(null)
    try {
      const result = await apiFetch<{ success: true; message: string }>(
        "/api/certificate/test",
        { method: "POST" },
      )
      setFeedback({ tone: "success", message: result.message })
    } catch (error) {
      setFeedback({
        tone: "warning",
        message:
          error instanceof Error ? error.message : "La prueba de firma no ha podido completarse.",
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <KeyRound className="h-4 w-4" />
            Verifactu / AEAT
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-pine-900 sm:text-3xl">
            Certificado Digital
          </h1>
          <p className="mt-1 text-sm text-graphite-500">
            Gestiona la firma electrónica para el envío de facturas verificables.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/configuracion">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a configuración
          </Link>
        </Button>
      </div>

      {feedback && (
        <div
          className={
            feedback.tone === "success"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          }
          role="status"
        >
          {feedback.message}
        </div>
      )}

      <CertificateStatusCard certificate={certificate} />
      <CertificateUploadForm
        onSave={handleSave}
        onTestSignature={handleTestSignature}
        hasCertificate={Boolean(certificate)}
        isSaving={isSaving}
        isTesting={isTesting}
      />
    </div>
  )
}

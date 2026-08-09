"use client"

import { useCallback, useEffect, useState } from "react"
import { CertificateStatusCard } from "@/components/settings/certificate-status-card"
import { CertificateUploadForm } from "@/components/settings/certificate-upload-form"
import { apiFetch } from "@/lib/api-client"
import type {
  CertificateUploadPayload,
  StoredDigitalCertificate,
} from "@/lib/settings/certificate-storage"

interface CompanyCertificatePanelProps {
  companyId?: string
  title?: string
  description?: string
  onCertificateChange?: (certificate: StoredDigitalCertificate | null) => void
}

function buildCertificateUrl(companyId?: string): string {
  if (!companyId) return "/api/certificate"
  return `/api/certificate?companyId=${encodeURIComponent(companyId)}`
}

export function CompanyCertificatePanel({
  companyId,
  title = "Certificado digital del declarante",
  description = "Necesario para vincular la presentación de impuestos y modelos con AEAT y otros organismos. El NIF del certificado se usará en los borradores fiscales si la empresa no tiene CIF registrado.",
  onCertificateChange,
}: CompanyCertificatePanelProps) {
  const [certificate, setCertificate] = useState<StoredDigitalCertificate | null>(null)
  const [feedback, setFeedback] = useState<{ tone: "success" | "warning"; message: string } | null>(
    null,
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadCertificate = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await apiFetch<{ success: true; certificate: StoredDigitalCertificate | null }>(
        buildCertificateUrl(companyId),
      )
      setCertificate(response.certificate)
      onCertificateChange?.(response.certificate)
    } catch {
      setCertificate(null)
      onCertificateChange?.(null)
    } finally {
      setIsLoading(false)
    }
  }, [companyId, onCertificateChange])

  useEffect(() => {
    void loadCertificate()
  }, [loadCertificate])

  const handleSave = async (payload: CertificateUploadPayload) => {
    setIsSaving(true)
    setFeedback(null)
    try {
      const response = await apiFetch<{
        success: true
        certificate: StoredDigitalCertificate
        message: string
      }>("/api/certificate", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          ...(companyId ? { companyId } : {}),
        }),
      })

      setCertificate(response.certificate)
      onCertificateChange?.(response.certificate)
      setFeedback({ tone: "success", message: response.message })
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
      const result = await apiFetch<{ success: true; message: string }>("/api/certificate/test", {
        method: "POST",
        body: JSON.stringify(companyId ? { companyId } : {}),
      })
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

  const handleDelete = async () => {
    if (!certificate) return
    if (
      !window.confirm(
        "¿Eliminar el certificado digital configurado? Deberás subir uno nuevo para presentar modelos firmados.",
      )
    ) {
      return
    }

    setIsDeleting(true)
    setFeedback(null)
    try {
      await apiFetch<{ success: true; message: string }>(buildCertificateUrl(companyId), {
        method: "DELETE",
      })
      setCertificate(null)
      onCertificateChange?.(null)
      setFeedback({ tone: "success", message: "Certificado eliminado correctamente." })
    } catch (error) {
      setFeedback({
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar el certificado. Inténtalo de nuevo.",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-pine-900">{title}</h3>
        <p className="mt-1 text-sm text-graphite-500">{description}</p>
      </div>

      {feedback ? (
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
      ) : null}

      {isLoading ? (
        <p className="text-sm text-graphite-500">Cargando certificado…</p>
      ) : (
        <>
          <CertificateStatusCard
            certificate={certificate}
            onDelete={certificate ? handleDelete : undefined}
            isDeleting={isDeleting}
          />
          <CertificateUploadForm
            onSave={handleSave}
            onTestSignature={handleTestSignature}
            hasCertificate={Boolean(certificate)}
            isSaving={isSaving}
            isTesting={isTesting}
          />
        </>
      )}
    </div>
  )
}

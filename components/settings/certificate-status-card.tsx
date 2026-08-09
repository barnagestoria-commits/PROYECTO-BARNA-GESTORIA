"use client"

import { BadgeCheck, Loader2, ShieldAlert, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  VERIFACTU_ENV_LABELS,
  formatCertificateExpiry,
  type StoredDigitalCertificate,
} from "@/lib/settings/certificate-storage"

interface CertificateStatusCardProps {
  certificate: StoredDigitalCertificate | null
  onDelete?: () => void
  isDeleting?: boolean
}

export function CertificateStatusCard({
  certificate,
  onDelete,
  isDeleting = false,
}: CertificateStatusCardProps) {
  if (!certificate) {
    return (
      <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <CardTitle className="text-lg text-amber-900">Certificado no configurado</CardTitle>
              <p className="mt-1 text-sm text-amber-800">
                Requerido para la firma de facturas Verifactu.
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BadgeCheck className="h-5 w-5 text-emerald-700" />
            <CardTitle className="text-lg text-pine-900">Estado del certificado</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              Certificado Activo
            </Badge>
            {onDelete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={onDelete}
                disabled={isDeleting}
                title="Eliminar certificado"
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Eliminar
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <InfoItem label="Titular" value={certificate.holderName} />
        <InfoItem label="NIF emisor" value={certificate.issuerNif} mono />
        <InfoItem
          label="Caducidad"
          value={`Válido hasta ${formatCertificateExpiry(certificate.expiresAt)}`}
        />
        <InfoItem label="Entorno" value={VERIFACTU_ENV_LABELS[certificate.environment]} />
        <InfoItem label="Archivo" value={certificate.fileName} className="sm:col-span-2" />
      </CardContent>
    </Card>
  )
}

function InfoItem({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: string
  mono?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-graphite-500">{label}</p>
      <p className={`mt-1 text-sm font-medium text-pine-900 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  )
}

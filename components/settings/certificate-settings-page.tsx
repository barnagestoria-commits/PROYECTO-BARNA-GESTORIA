"use client"

import Link from "next/link"
import { ArrowLeft, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CompanyCertificatePanel } from "@/components/settings/company-certificate-panel"

export function CertificateSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" data-tour="onboarding-certificate">
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
            Gestiona la firma electrónica para el envío de facturas verificables y presentaciones fiscales.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/configuracion">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a configuración
          </Link>
        </Button>
      </div>

      <CompanyCertificatePanel />
    </div>
  )
}

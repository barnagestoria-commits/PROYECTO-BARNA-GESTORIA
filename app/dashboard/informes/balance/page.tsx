"use client"

import { InformeDownloadCard } from "@/components/informe-download-card"
import { Scale } from "lucide-react"

export default function BalancePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <InformeDownloadCard
        title="Balance de Situación"
        description="Estado de situación patrimonial con activo, pasivo y patrimonio neto. Elige el nivel de detalle al listar: cuentas de nivel 3, nivel 4 o subcuentas."
        icon={Scale}
        reportType="balance"
      />
    </div>
  )
}

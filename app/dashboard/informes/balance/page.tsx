"use client"

import { InformeDownloadCard } from "@/components/informe-download-card"
import { Scale } from "lucide-react"

export default function BalancePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <InformeDownloadCard
        title="Balance de Situación"
        description="Estado de situación patrimonial con activo, pasivo y patrimonio neto a fecha de cierre."
        icon={Scale}
      />
    </div>
  )
}

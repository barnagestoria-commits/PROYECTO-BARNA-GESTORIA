"use client"

import { InformeDownloadCard } from "@/components/informe-download-card"
import { BarChart3 } from "lucide-react"

export default function SumasSaldosPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <InformeDownloadCard
        title="Sumas y Saldos"
        description="Mayor resumido con totales de debe, haber y saldo por cuenta contable del ejercicio."
        icon={BarChart3}
        reportType="sumas-saldos"
      />
    </div>
  )
}

"use client"

import { InformeDownloadCard } from "@/components/informe-download-card"
import { TrendingUp } from "lucide-react"

export default function PygPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <InformeDownloadCard
        title="Pérdidas y Ganancias (PyG)"
        description="Cuenta de resultados con ingresos, gastos y resultado del ejercicio según el PGC."
        icon={TrendingUp}
        reportType="pyg"
      />
    </div>
  )
}

"use client"

import { InformeDownloadCard } from "@/components/informe-download-card"
import { TrendingUp } from "lucide-react"

export default function PygPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <InformeDownloadCard
        title="Pérdidas y Ganancias (PyG)"
        description="Cuenta de resultados con ingresos, gastos y resultado del ejercicio. Elige el nivel de detalle al listar: cuentas de nivel 3, nivel 4 o subcuentas."
        icon={TrendingUp}
        reportType="pyg"
      />
    </div>
  )
}

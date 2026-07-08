"use client"

import { useParams } from "next/navigation"
import { InformeDownloadCard } from "@/components/informe-download-card"
import { Stamp } from "lucide-react"

const CERTIFICADOS: Record<string, { title: string; description: string }> = {
  "retenciones-profesionales": {
    title: "Certificado retenciones — Profesionales",
    description: "Certificado anual de retenciones e ingresos a cuenta (ámbito modelo 111).",
  },
  "retenciones-alquiler": {
    title: "Certificado retenciones — Alquileres",
    description: "Certificado de retenciones por arrendamientos de inmuebles urbanos (modelo 115).",
  },
  "resumen-anual": {
    title: "Resumen anual de retenciones",
    description: "Relación consolidada de certificados emitidos por cliente en el ejercicio.",
  },
}

export default function CertificadosPage() {
  const params = useParams<{ slug?: string[] }>()
  const slugKey = params.slug?.[0] ?? "retenciones-profesionales"
  const cert = CERTIFICADOS[slugKey] ?? CERTIFICADOS["retenciones-profesionales"]

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <InformeDownloadCard
        title={cert.title}
        description={cert.description}
        icon={Stamp}
        formats={["PDF"]}
      />
    </div>
  )
}

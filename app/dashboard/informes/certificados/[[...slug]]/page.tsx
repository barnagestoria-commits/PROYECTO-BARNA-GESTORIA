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
    description: "Exportación anual de los modelos 111, 115, 180 y 303 habilitados para el ejercicio.",
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
        certificadoSlug={slugKey}
      />
    </div>
  )
}

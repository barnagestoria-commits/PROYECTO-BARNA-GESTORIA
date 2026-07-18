import type { Metadata } from "next"
import { LegalPageLayout, LegalSection } from "@/components/legal-page-layout"

export const metadata: Metadata = {
  title: "Términos del servicio | Barna Gestoría",
  description:
    "Términos y condiciones de uso de la plataforma Barna Gestoría para clientes y gestorías.",
}

export default function TerminosServicioPage() {
  return (
    <LegalPageLayout
      title="Términos del servicio"
      description="Condiciones de uso de la plataforma. Requerido por Google Cloud OAuth verification y Microsoft Publisher Verification. Sustituye los marcadores antes del lanzamiento comercial."
    >
      <LegalSection
        title="1. Objeto del servicio"
        placeholder="Describe la plataforma SaaS de gestión contable, fiscal y documental para empresas, autónomos y gestorías."
      />

      <LegalSection
        title="2. Registro y cuentas"
        placeholder="Requisitos de edad, veracidad de datos, tipos de cuenta (GESTORIA / CLIENTE_FINAL), responsabilidad de credenciales."
      />

      <LegalSection
        title="3. Uso permitido"
        placeholder="Uso profesional/lícito, prohibición de ingeniería inversa, límites de uso automatizado, cumplimiento normativo fiscal."
      />

      <LegalSection
        title="4. Autenticación OAuth"
        placeholder="Al usar Google o Microsoft aceptas también sus términos; la plataforma solo usa OAuth para identificar al usuario."
      />

      <LegalSection
        title="5. Propiedad intelectual"
        placeholder="Titularidad del software, licencia limitada de uso, propiedad de los documentos subidos por el cliente."
      />

      <LegalSection
        title="6. Disponibilidad y soporte"
        placeholder="Nivel de servicio, mantenimientos programados, canales de soporte (email, WhatsApp)."
      />

      <LegalSection
        title="7. Limitación de responsabilidad"
        placeholder="Exclusiones legales permitidas; la plataforma no sustituye asesoramiento fiscal personalizado salvo contrato específico."
      />

      <LegalSection
        title="8. Resolución y baja"
        placeholder="Procedimiento de cancelación, exportación de datos, supresión tras plazo legal."
      />

      <LegalSection
        title="9. Ley aplicable y jurisdicción"
        placeholder="Legislación española, tribunales de Barcelona (o domicilio del prestador)."
      />
    </LegalPageLayout>
  )
}

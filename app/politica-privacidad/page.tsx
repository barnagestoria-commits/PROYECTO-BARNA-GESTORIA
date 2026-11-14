import type { Metadata } from "next"
import { LegalPageLayout, LegalSection } from "@/components/legal-page-layout"

export const metadata: Metadata = {
  title: "Política de privacidad | Taxlyn",
  description:
    "Política de privacidad de la plataforma Taxlyn. Información sobre tratamiento de datos y OAuth.",
}

export default function PoliticaPrivacidadPage() {
  return (
    <LegalPageLayout
      title="Política de privacidad"
      description="Documento legal requerido para la verificación de Google OAuth y Microsoft Entra ID. Sustituye los marcadores por el texto definitivo antes de publicar en producción comercial."
    >
      <LegalSection
        title="1. Responsable del tratamiento"
        placeholder="Identifica la entidad legal (razón social, CIF, domicilio, email de contacto DPO o privacidad)."
      />

      <LegalSection
        title="2. Datos que recopilamos"
        placeholder="Describe datos de registro (email, nombre), datos fiscales/contables subidos, metadatos de sesión y logs técnicos."
      />

      <LegalSection
        title="3. Inicio de sesión con Google y Microsoft"
        placeholder="Explica qué datos recibes del proveedor OAuth (email, nombre, identificador del proveedor), finalidad (autenticación) y que no accedes al contenido del correo ni calendario salvo permisos explícitos futuros."
      />

      <LegalSection
        title="4. Base legal y finalidad"
        placeholder="Ejecución de contrato, consentimiento, interés legítimo según RGPD/LOPDGDD para cada categoría de datos."
      />

      <LegalSection title="5. Conservación y seguridad">
        <p className="text-sm leading-relaxed text-graphite-700">
          La sesión y, si el usuario lo acepta, el recuerdo del dispositivo se guardan en cookies técnicas
          httpOnly. El código de verificación se envía al correo de la cuenta y no se conserva en claro. El
          registro de que el usuario aceptó recordar un dispositivo incluye la fecha y la versión del texto
          aceptado, y se conserva mientras el dispositivo siga autorizado y el tiempo necesario para atender
          una reclamación.
        </p>
      </LegalSection>

      <LegalSection
        title="6. Cesiones y encargados"
        placeholder="Proveedores (Vercel, Neon, DeepSeek OCR si aplica), cláusulas contractuales y transferencias internacionales."
      />

      <LegalSection
        title="7. Derechos de las personas usuarias"
        placeholder="Acceso, rectificación, supresión, oposición, portabilidad, reclamación ante AEPD. Procedimiento y plazos de respuesta."
      />

      <LegalSection
        title="8. Cookies"
        placeholder="Cookie de sesión barna_session (httpOnly, secure en producción). Cookies técnicas de NextAuth durante el flujo OAuth."
      />
    </LegalPageLayout>
  )
}

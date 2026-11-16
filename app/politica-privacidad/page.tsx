import type { Metadata } from "next"
import { LegalDraftNotice, LegalList, LegalP, LegalPageLayout, LegalSection } from "@/components/legal-page-layout"
import { COMPANY_INFO, companyField } from "@/lib/legal/company-info"

export const metadata: Metadata = {
  title: "Política de privacidad | Taxlyn",
  description: "Cómo trata Taxlyn los datos personales de sus personas usuarias y de los datos que gestionan con el programa.",
}

export default function PoliticaPrivacidadPage() {
  return (
    <LegalPageLayout
      title="Política de privacidad"
      description="Información sobre el tratamiento de datos personales conforme al RGPD y la LOPDGDD."
    >
      <LegalDraftNotice />

      <LegalSection title="1. Responsable y encargado del tratamiento">
        <LegalP>
          Responsable de los datos de registro y uso de la cuenta: {companyField(COMPANY_INFO.holderName)} · NIF:{" "}
          {companyField(COMPANY_INFO.taxId)} · Domicilio: {companyField(COMPANY_INFO.address)} · Contacto de privacidad:{" "}
          {COMPANY_INFO.contactEmail}.
        </LegalP>
        <LegalP>
          Respecto de los datos de terceros que tú introduces en Taxlyn (clientes, proveedores, empleados, etc.), tú
          eres el responsable y Taxlyn actúa como encargado del tratamiento, según el Anexo de los Términos del servicio.
        </LegalP>
      </LegalSection>

      <LegalSection title="2. Datos que tratamos">
        <LegalList
          items={[
            "Registro y cuenta: nombre, correo electrónico, teléfono (opcional), contraseña (guardada cifrada con hash, nunca en claro), tipo de cuenta, empresa y NIF/CIF.",
            "Contenido que subes: facturas, extractos bancarios, asientos contables, datos fiscales y documentos de tu actividad.",
            "Pagos: justificantes de transferencia que subes, importe, plan solicitado y fecha. No almacenamos números de tarjeta.",
            "Técnicos: sesión, dispositivos de confianza, registros de acceso y de actividad, y dirección IP para seguridad y límites de intentos.",
            "Aceptación legal: fecha y versión de los Términos aceptados.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Inicio de sesión con Google y Microsoft">
        <LegalP>
          Si eliges esta opción recibimos de tu proveedor únicamente tu correo y nombre para identificarte. No
          accedemos al contenido de tu correo ni de tu calendario.
        </LegalP>
      </LegalSection>

      <LegalSection title="4. Finalidades y base jurídica">
        <LegalList
          items={[
            "Prestarte el servicio, gestionar tu cuenta, la prueba gratuita y los pagos: ejecución del contrato (art. 6.1.b RGPD).",
            "Enviarte avisos del servicio (fin de la prueba, plazos de supresión, verificación de acceso): ejecución del contrato e interés legítimo.",
            "Seguridad, prevención del fraude y límites de acceso: interés legítimo (art. 6.1.f).",
            "Cumplir obligaciones legales, como las fiscales y contables: obligación legal (art. 6.1.c).",
            "Lectura automática de documentos (OCR): ejecución del contrato, a petición tuya al subir el documento.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Conservación y seguridad">
        <LegalList
          items={[
            "Cuenta activa: conservamos tus datos mientras mantengas el servicio.",
            "Prueba sin contratar: 7 días de uso, 15 días de solo lectura y descarga, y después supresión definitiva de la cuenta, sus datos y sus archivos.",
            "Baja: tras la baja suprimimos los datos, salvo los que debamos conservar bloqueados para atender responsabilidades o por obligación legal (por ejemplo, justificantes de pago y facturación).",
            "Los libros y registros contables tienen un plazo mercantil de conservación de 6 años (art. 30 del Código de Comercio); descárgalos antes de la supresión.",
            "Seguridad: documentos en almacenamiento privado, conexiones cifradas, contraseñas con hash, límites de intentos y acceso restringido del personal.",
          ]}
        />
        <LegalP>
          La sesión y, si el usuario lo acepta, el recuerdo del dispositivo se guardan en cookies técnicas httpOnly. El
          código de verificación se envía al correo de la cuenta y no se conserva en claro. El registro de que el
          usuario aceptó recordar un dispositivo incluye la fecha y la versión del texto aceptado, y se conserva
          mientras el dispositivo siga autorizado y el tiempo necesario para atender una reclamación.
        </LegalP>
      </LegalSection>

      <LegalSection title="6. Destinatarios, encargados y transferencias internacionales">
        <LegalP>No vendemos tus datos. Recurrimos a proveedores que tratan datos por nuestra cuenta:</LegalP>
        <LegalList
          items={[
            "Vercel Inc. (EE. UU.): alojamiento de la aplicación y almacenamiento privado de archivos.",
            "Proveedor de base de datos PostgreSQL (actualmente Neon; previsto Supabase), con región europea cuando esté disponible.",
            "Proveedor de correo electrónico (SMTP) para los avisos del servicio.",
            "Google y Microsoft, solo si eliges iniciar sesión con ellos.",
            "DeepSeek (China): lectura automática (OCR) del contenido de las facturas y extractos que subas a esa función. Supone una transferencia internacional de datos fuera del Espacio Económico Europeo. Si no deseas ese tratamiento, no uses la función de lectura automática y registra los datos manualmente.",
          ]}
        />
        <LegalP>
          Las transferencias a EE. UU. se apoyan en el Marco de Privacidad de Datos UE-EE. UU. o en cláusulas
          contractuales tipo, según el proveedor. Podemos cambiar de proveedor informando en esta política.
        </LegalP>
      </LegalSection>

      <LegalSection title="7. Tus derechos">
        <LegalP>
          Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad
          escribiendo a {COMPANY_INFO.contactEmail}, indicando tu solicitud y acreditando tu identidad. Respondemos en
          el plazo de un mes. Puedes descargar tus datos desde la aplicación («Descargar mis datos»). Si consideras que
          tus derechos no han sido atendidos, puedes reclamar ante la Agencia Española de Protección de Datos
          (www.aepd.es).
        </LegalP>
      </LegalSection>

      <LegalSection title="8. Cookies">
        <LegalP>Usamos solo cookies técnicas necesarias; no usamos cookies de publicidad ni de seguimiento.</LegalP>
        <LegalList
          items={[
            "barna_session: mantiene tu sesión iniciada (httpOnly; segura en producción).",
            "taxlyn_device: recuerda un dispositivo de confianza durante 90 días, solo si lo aceptas.",
            "Cookies técnicas temporales durante el inicio de sesión con Google o Microsoft.",
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Cambios en esta política">
        <LegalP>
          Si la actualizamos de forma relevante te lo comunicaremos por correo o en la aplicación. La versión vigente
          es la indicada en la fecha de última actualización.
        </LegalP>
      </LegalSection>
    </LegalPageLayout>
  )
}

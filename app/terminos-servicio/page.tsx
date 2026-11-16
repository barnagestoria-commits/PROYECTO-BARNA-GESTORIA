import type { Metadata } from "next"
import { LegalDraftNotice, LegalList, LegalP, LegalPageLayout, LegalSection } from "@/components/legal-page-layout"
import { COMPANY_INFO, companyField } from "@/lib/legal/company-info"

export const metadata: Metadata = {
  title: "Términos del servicio | Taxlyn",
  description:
    "Condiciones de uso del programa Taxlyn de gestión contable y fiscal para empresas, autónomos y despachos.",
}

export default function TerminosServicioPage() {
  return (
    <LegalPageLayout
      title="Términos del servicio"
      description="Condiciones que regulan el uso de Taxlyn, el programa de gestión contable y fiscal."
    >
      <LegalDraftNotice />

      <LegalSection title="1. Quiénes somos y objeto del servicio">
        <LegalP>
          Taxlyn ({COMPANY_INFO.website}) es un programa informático, ofrecido como servicio en línea, de gestión
          contable y fiscal (contabilidad, IVA, modelos tributarios, IRPF, impuesto de sociedades) y documental
          (facturas, extractos bancarios, ficha de empresa) para empresas, autónomos y despachos profesionales.
        </LegalP>
        <LegalP>
          Taxlyn es una herramienta de software. No es una gestoría, no presta asesoramiento fiscal o laboral
          personalizado ni gestiona nóminas. Las cuentas de tipo «despacho» corresponden a despachos que usan
          Taxlyn como herramienta; Taxlyn no se presenta como despacho profesional.
        </LegalP>
        <LegalP>
          Prestador: {companyField(COMPANY_INFO.holderName)} · NIF: {companyField(COMPANY_INFO.taxId)} · Domicilio:{" "}
          {companyField(COMPANY_INFO.address)} · Contacto: {COMPANY_INFO.contactEmail}.
        </LegalP>
      </LegalSection>

      <LegalSection title="2. Registro y cuentas">
        <LegalList
          items={[
            "Para registrarte debes ser mayor de edad y tener capacidad para contratar, o actuar en nombre de la empresa o despacho que representas.",
            "Los datos que facilites deben ser veraces y mantenerse actualizados.",
            "Eres responsable de custodiar tus credenciales y de toda actividad realizada con tu cuenta. Avísanos de inmediato si sospechas un acceso no autorizado.",
            "Al crear la cuenta aceptas estos Términos y la Política de privacidad; guardamos la fecha y la versión aceptadas.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Prueba gratuita">
        <LegalP>Toda cuenta nueva dispone de una prueba gratuita con las siguientes fases:</LegalP>
        <LegalList
          items={[
            "Días 1 a 7: acceso completo a todas las funciones.",
            "Días 8 a 22 (15 días): si no has contratado un plan, la cuenta pasa a modo de solo lectura. No podrás crear ni modificar datos, pero sí consultarlos y descargarlos.",
            "Pasado ese plazo sin contratar: la cuenta y sus datos se eliminan de forma definitiva. Antes recibirás avisos por correo electrónico.",
            "En cualquier momento de la prueba puedes descargar todos tus datos desde la propia aplicación («Descargar mis datos»).",
          ]}
        />
        <LegalP>
          Contratar un plan durante la prueba o en el periodo de solo lectura reactiva el acceso completo y conserva
          todos tus datos.
        </LegalP>
      </LegalSection>

      <LegalSection title="4. Planes, precios y pago">
        <LegalList
          items={[
            "Los planes y precios vigentes se muestran en la aplicación (Configuración > Suscripción). Salvo que se indique lo contrario, se expresan por mes.",
            "Por ahora el pago se realiza por transferencia bancaria a la cuenta indicada en el proceso de contratación, usando como concepto la referencia que te mostramos, y subiendo el justificante.",
            "El plan se activa cuando validamos manualmente el pago; puede tardar un plazo razonable en días laborables. Si el pago no coincide con el plan o el importe, te lo comunicaremos.",
            "Los cambios de plan siguen el mismo procedimiento: se solicitan en la aplicación y se activan al validar el pago correspondiente.",
            "Nos reservamos el derecho de modificar los precios para el futuro, avisando con antelación razonable. Un cambio no afecta al periodo ya pagado.",
          ]}
        />
        <LegalP>Los impuestos aplicables se indicarán conforme a la normativa vigente en el momento de la factura.</LegalP>
      </LegalSection>

      <LegalSection title="5. Uso permitido">
        <LegalList
          items={[
            "Usa Taxlyn para fines profesionales y lícitos, y cumple la normativa fiscal y contable aplicable.",
            "No está permitido el acceso no autorizado, la ingeniería inversa, la sobrecarga deliberada del servicio ni el uso automatizado abusivo.",
            "No subas contenido ilícito ni documentos de terceros sin legitimación para tratarlos.",
            "Puedes suspender o cancelar el acceso a usuarios de tu cuenta; eres responsable de las personas a las que des acceso.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Inicio de sesión con Google o Microsoft">
        <LegalP>
          Si inicias sesión con Google o Microsoft, aceptas también las condiciones de ese proveedor. Taxlyn solo usa
          ese inicio de sesión para identificarte (correo y nombre) y no accede al contenido de tu correo ni de tu
          calendario.
        </LegalP>
      </LegalSection>

      <LegalSection title="7. Tus datos y propiedad intelectual">
        <LegalList
          items={[
            "Los datos y documentos que subas son tuyos. Nos concedes únicamente el derecho necesario para almacenarlos, procesarlos y mostrártelos para prestar el servicio.",
            "El software, su diseño y marca son titularidad del prestador. Recibes una licencia limitada, no exclusiva e intransferible de uso mientras tengas acceso al servicio.",
            "Cuando Taxlyn trate datos personales de terceros por cuenta tuya (por ejemplo, clientes o proveedores de tu empresa), se aplica el Anexo de encargo del tratamiento de estos Términos.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Disponibilidad y soporte">
        <LegalP>
          Nos esforzamos por mantener el servicio disponible, pero no garantizamos un funcionamiento ininterrumpido.
          Podemos realizar mantenimientos y actualizaciones, avisando cuando sea razonablemente posible. El soporte se
          presta por correo en {COMPANY_INFO.contactEmail}. Te recomendamos descargar copias de tus datos con
          regularidad.
        </LegalP>
      </LegalSection>

      <LegalSection title="9. Limitación de responsabilidad">
        <LegalList
          items={[
            "Taxlyn es una herramienta de apoyo: la exactitud de los datos, la revisión de los cálculos y la presentación de declaraciones ante la Administración son responsabilidad del usuario o de su asesor.",
            "Las funciones de lectura automática de documentos (OCR) y los cálculos automáticos pueden contener errores y deben revisarse antes de usarse.",
            "En la medida permitida por la ley, no respondemos de daños indirectos, lucro cesante ni pérdidas derivadas de un uso indebido, de credenciales compartidas o de dispositivos marcados como de confianza.",
            "Nada de lo anterior limita derechos que la ley reconoce irrenunciablemente a los consumidores ni la responsabilidad por dolo o negligencia grave.",
          ]}
        />
      </LegalSection>

      <LegalSection title="10. Baja, exportación y supresión de datos">
        <LegalList
          items={[
            "Puedes darte de baja cuando quieras. La baja no genera reembolso del periodo ya pagado, salvo que la ley disponga otra cosa.",
            "Puedes descargar tus datos en cualquier momento (archivo ZIP con datos en JSON/CSV y los documentos originales).",
            "Tras la baja o el vencimiento de la prueba sin contratación, suprimimos tus datos conforme a estos Términos y a la Política de privacidad. Si necesitas conservar los libros contables, la normativa mercantil exige conservarlos durante 6 años (art. 30 del Código de Comercio): descárgalos antes de la supresión.",
            "Podemos suspender o cancelar cuentas que incumplan estos Términos, avisando cuando sea posible.",
          ]}
        />
      </LegalSection>

      <div id="dispositivos-de-confianza">
        <LegalSection title="11. Verificación por correo y dispositivos de confianza">
          <p className="text-sm leading-relaxed text-graphite-700">
            Quien active la verificación en dos pasos recibe un código en su correo para completar el acceso.
            Si marca «Recordar este dispositivo», acepta que Taxlyn no vuelva a pedir ese código en ese equipo
            durante 90 días. El acceso que se haga desde ese dispositivo se entiende realizado por el titular de
            la cuenta. Taxlyn no responde de los usos, pérdidas o accesos de terceros cuando el cliente ha marcado
            el dispositivo como de confianza, ha compartido su contraseña o ha dejado la sesión abierta.
          </p>
        </LegalSection>
      </div>

      <LegalSection title="12. Modificaciones">
        <LegalP>
          Podemos actualizar estos Términos. Si el cambio es relevante te lo comunicaremos por correo o en la
          aplicación con antelación razonable; si no lo aceptas, podrás darte de baja y descargar tus datos.
        </LegalP>
      </LegalSection>

      <LegalSection title="13. Ley aplicable y jurisdicción">
        <LegalP>
          Estos Términos se rigen por la legislación española. Para cualquier controversia serán competentes{" "}
          {COMPANY_INFO.jurisdiction}, sin perjuicio de los derechos que correspondan al consumidor.
        </LegalP>
      </LegalSection>

      <LegalSection title="Anexo. Encargo del tratamiento (art. 28 RGPD)">
        <LegalP>
          Cuando uses Taxlyn para tratar datos personales de terceros (clientes, proveedores, empleados de tu empresa,
          etc.), tú eres el responsable del tratamiento y Taxlyn actúa como encargado. Este anexo regula ese encargo.
        </LegalP>
        <LegalList
          items={[
            "Objeto y duración: prestación del servicio de gestión contable, fiscal y documental mientras la cuenta esté activa, más el plazo de descarga y supresión previsto en estos Términos.",
            "Datos y personas afectadas: datos identificativos, fiscales, de facturación y bancarios incluidos en los documentos y registros que subas; titulares: clientes, proveedores, empleados y otros terceros de tu actividad.",
            "Instrucciones: trataremos los datos solo para prestarte el servicio y según tus instrucciones documentadas (uso de la aplicación y estos Términos).",
            "Confidencialidad: el personal con acceso está sujeto a deber de confidencialidad.",
            "Seguridad: aplicamos medidas técnicas y organizativas adecuadas (control de acceso, almacenamiento privado de documentos, cifrado en tránsito, límites de intentos de acceso).",
            "Subencargados: autorizas el uso de los proveedores listados en la Política de privacidad (alojamiento, base de datos, correo, lectura de documentos). Te informaremos de cambios para que puedas oponerte.",
            "Asistencia: te ayudaremos, en lo razonable, a atender derechos de las personas afectadas y a cumplir tus obligaciones de seguridad y notificación de brechas.",
            "Notificación de brechas: te avisaremos sin dilación indebida si tenemos conocimiento de una brecha que afecte a tus datos.",
            "Fin del servicio: al terminar, podrás descargar los datos y, transcurridos los plazos indicados, los suprimiremos, salvo que la ley exija conservarlos.",
            "Auditoría: pondremos a tu disposición la información necesaria para demostrar el cumplimiento de este anexo.",
          ]}
        />
      </LegalSection>
    </LegalPageLayout>
  )
}

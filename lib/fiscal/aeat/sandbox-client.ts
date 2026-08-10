import type { AeatSubmissionValidationResult } from "@/lib/fiscal/aeat/validate-submission"
import { validateAeatSubmission } from "@/lib/fiscal/aeat/validate-submission"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

/**
 * Servicios web AEAT documentados en el portal de desarrolladores.
 * @see https://www.agenciatributaria.es/AEAT.desarrolladores/
 *
 * Nota: GZ28.shtml no es el portal de desarrollo; es un trámite de rectificación.
 */
export const AEAT_SANDBOX_SERVICES = {
  developerPortal: "https://www.agenciatributaria.es/AEAT.desarrolladores/",
  pre303Import: "https://sede.agenciatributaria.gob.es/Sede/iva/pre-303.html",
  recordDesigns: "https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro.html",
} as const

export type AeatValidationSource = "local-boe" | "aeat-sandbox"

export interface AeatOfficialValidationResult extends AeatSubmissionValidationResult {
  /** Origen de la validación aplicada. */
  source: AeatValidationSource
  /** Indica si hay credenciales/configuración para el sandbox AEAT. */
  sandboxConfigured: boolean
  /** Mensaje informativo sobre validación remota (cuando no hay certificado). */
  sandboxNotice?: string
}

function isAeatSandboxConfigured(): boolean {
  return Boolean(
    process.env.AEAT_SANDBOX_ENABLED === "true" &&
      process.env.AEAT_CERT_PATH &&
      process.env.AEAT_CERT_PASSWORD,
  )
}

/**
 * Valida el borrador telemático según diseño de registro BOE (500 posiciones).
 *
 * La sede AEAT exige certificado digital para presentación y servicios web reales.
 * Con `AEAT_SANDBOX_ENABLED=true` y certificado configurado, este módulo podrá
 * delegar en Pre303 / servicios del portal de desarrolladores (fase posterior).
 */
export async function validateWithOfficialAeatPipeline(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Promise<AeatOfficialValidationResult> {
  const local = validateAeatSubmission(detail, companyName, companyCif)
  const sandboxConfigured = isAeatSandboxConfigured()

  if (!sandboxConfigured) {
    return {
      ...local,
      source: "local-boe",
      sandboxConfigured: false,
      sandboxNotice:
        "Validación local BOE (500 pos.). Para validación en sandbox AEAT, configure certificado y AEAT_SANDBOX_ENABLED.",
    }
  }

  // Punto de extensión: llamada SOAP/REST al servicio Pre303 del portal desarrolladores.
  return {
    ...local,
    source: "local-boe",
    sandboxConfigured: true,
    sandboxNotice:
      "Certificado AEAT detectado; validación remota sandbox pendiente de integración WSDL.",
  }
}

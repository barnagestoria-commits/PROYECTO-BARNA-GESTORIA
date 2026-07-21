export type VerifactuEnvironment = "sandbox" | "production"

export interface StoredDigitalCertificate {
  fileName: string
  holderName: string
  issuerNif: string
  expiresAt: string
  environment: VerifactuEnvironment
  uploadedAt: string
}

export interface CertificateUploadPayload {
  fileName: string
  password: string
  environment: VerifactuEnvironment
}

const STORAGE_KEY = "gestoria-digital-certificate"

export function loadStoredCertificate(): StoredDigitalCertificate | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredDigitalCertificate
  } catch {
    return null
  }
}

export function saveStoredCertificate(certificate: StoredDigitalCertificate): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(certificate))
}

export function clearStoredCertificate(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function buildMockCertificate(payload: CertificateUploadPayload): StoredDigitalCertificate {
  const now = new Date()
  const expires = new Date(now)
  expires.setFullYear(expires.getFullYear() + 2)
  expires.setMonth(11)

  return {
    fileName: payload.fileName,
    holderName: "Barna Gestoría SL",
    issuerNif: "B00000083",
    expiresAt: expires.toISOString(),
    environment: payload.environment,
    uploadedAt: now.toISOString(),
  }
}

export function formatCertificateExpiry(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString("es-ES", { month: "2-digit", year: "numeric" })
}

export const VERIFACTU_ENV_LABELS: Record<VerifactuEnvironment, string> = {
  sandbox: "Modo Pruebas / Sandbox AEAT",
  production: "Modo Producción Real",
}

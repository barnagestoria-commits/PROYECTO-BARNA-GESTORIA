import type { VerifactuEnvironment } from "@/lib/settings/certificate-storage"
import { VERIFACTU_ENV_LABELS } from "@/lib/settings/certificate-storage"

const VERIFACTU_BASE_URL: Record<VerifactuEnvironment, string> = {
  sandbox: "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR",
  production: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR",
}

export interface VerifactuQrParams {
  environment: VerifactuEnvironment
  issuerNif: string
  invoiceNumber: string
  issueDate: string
  totalAmount: number
  recordHash?: string
}

function formatVerifactuDate(isoDate: string): string {
  const date = isoDate.includes("T") ? isoDate.slice(0, 10) : isoDate
  const [year, month, day] = date.split("-")
  if (!year || !month || !day) return date
  return `${day}-${month}-${year}`
}

function formatVerifactuAmount(amount: number): string {
  return amount.toFixed(2)
}

/** URL oficial de cotejo AEAT para el QR Veri*factu. */
export function buildVerifactuVerificationUrl(params: VerifactuQrParams): string {
  const url = new URL(VERIFACTU_BASE_URL[params.environment])
  url.searchParams.set("nif", params.issuerNif.replace(/\s/g, "").toUpperCase())
  url.searchParams.set("numserie", params.invoiceNumber.trim())
  url.searchParams.set("fecha", formatVerifactuDate(params.issueDate))
  url.searchParams.set("importe", formatVerifactuAmount(params.totalAmount))
  if (params.recordHash?.trim()) {
    url.searchParams.set("huella", params.recordHash.trim())
  }
  return url.toString()
}

export function buildVerifactuQrCaption(environment: VerifactuEnvironment): string {
  const envLabel = VERIFACTU_ENV_LABELS[environment]
  return `Factura verificable en la sede electrónica de la AEAT (${envLabel}). Veri*factu.`
}

export async function generateQrDataUrl(content: string, size = 140): Promise<string> {
  const QRCode = await import("qrcode")
  return QRCode.toDataURL(content, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: { dark: "#2C2C2C", light: "#FFFFFF" },
  })
}

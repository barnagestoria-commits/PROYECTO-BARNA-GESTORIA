/**
 * Prueba gratuita de OCR para todas las cuentas (autónomo, empresa y despacho).
 * DeepSeek cobra cada análisis; el tope evita un coste abierto y deja ~60 % de
 * margen cuando la función pase a formar parte del plan de pago.
 */
export const OCR_FREE_INVOICE_LIMIT = 8

export const OCR_QUOTA_CODE = "OCR_QUOTA_EXCEEDED"

export const OCR_QUOTA_MESSAGE =
  "Si deseas seguir utilizando esta función actualiza tu plan de suscripción"

export const OCR_QUOTA_SUBSCRIBE_HREF = "/configuracion#suscripcion"

export interface OcrInvoiceUsage {
  used: number
  limit: number
  remaining: number
}

export function ocrInvoiceUsage(used: number, limit = OCR_FREE_INVOICE_LIMIT): OcrInvoiceUsage {
  const safeUsed = Math.max(0, Math.floor(used))
  const remaining = Math.max(0, limit - safeUsed)
  return { used: safeUsed, limit, remaining }
}

export function isOcrQuotaExhausted(used: number, limit = OCR_FREE_INVOICE_LIMIT): boolean {
  return ocrInvoiceUsage(used, limit).remaining <= 0
}

export const UPLOAD_LIMITS_BYTES = {
  invoice: 10 * 1024 * 1024,
  document: 15 * 1024 * 1024,
  bankStatement: 25 * 1024 * 1024,
  certificate: 2 * 1024 * 1024,
} as const

export const MAX_BANK_MOVEMENTS = 50_000
export const MAX_BANK_WARNINGS = 25
export const BANK_PREVIEW_SAMPLE_SIZE = 8
export const DEDUPE_LOOKUP_CHUNK_SIZE = 500

export function assertUploadSize(byteSize: number, limitBytes: number, label: string): void {
  if (byteSize > limitBytes) {
    const megabytes = Math.round(limitBytes / (1024 * 1024))
    throw new Error(`${label} supera el tamaño máximo de ${megabytes} MB.`)
  }
}

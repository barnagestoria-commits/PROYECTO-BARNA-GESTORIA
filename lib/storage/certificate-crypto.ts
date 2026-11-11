import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

const VERSION = 1
const IV_LENGTH = 12
const TAG_LENGTH = 16
const KEY_LENGTH = 32

function masterKey(): Buffer {
  const raw = process.env.CERTIFICATE_ENCRYPTION_KEY?.trim()
  if (!raw) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
      throw new Error(
        "Falta CERTIFICATE_ENCRYPTION_KEY. Los certificados .p12 no pueden cifrarse para el almacén de objetos.",
      )
    }
    return createHash("sha256").update("taxlyn-dev-certificate-key").digest()
  }
  if (raw.length >= 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw.slice(0, 64), "hex")
  }
  return createHash("sha256").update(raw).digest()
}

function deriveKey(companyId: string): Buffer {
  return createHash("sha256")
    .update(Buffer.concat([masterKey(), Buffer.from(companyId, "utf8")]))
    .digest()
    .subarray(0, KEY_LENGTH)
}

export function encryptCertificatePayload(params: {
  companyId: string
  p12: Buffer
  password: string
}): Buffer {
  const payload = Buffer.from(
    JSON.stringify({
      v: VERSION,
      p12: params.p12.toString("base64"),
      password: params.password,
    }),
    "utf8",
  )
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", deriveKey(params.companyId), iv)
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, encrypted])
}

export function decryptCertificatePayload(
  companyId: string,
  envelope: Buffer,
): { p12: Buffer; password: string } {
  if (envelope.length < 1 + IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("El certificado cifrado está incompleto.")
  }
  const version = envelope[0]
  if (version !== VERSION) {
    throw new Error("Versión de cifrado del certificado no soportada.")
  }
  const iv = envelope.subarray(1, 1 + IV_LENGTH)
  const tag = envelope.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH)
  const encrypted = envelope.subarray(1 + IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(companyId), iv)
  decipher.setAuthTag(tag)
  const payload = Buffer.concat([decipher.update(encrypted), decipher.final()])
  const parsed = JSON.parse(payload.toString("utf8")) as { p12?: string; password?: string }
  if (!parsed.p12 || typeof parsed.password !== "string") {
    throw new Error("El sobre del certificado no es válido.")
  }
  return {
    p12: Buffer.from(parsed.p12, "base64"),
    password: parsed.password,
  }
}

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto"

const SALT_LENGTH = 16
const SCRYPT_KEY_LENGTH = 64

function safeEqualHex(stored: string, candidate: string): boolean {
  const storedBuffer = Buffer.from(stored, "hex")
  const candidateBuffer = Buffer.from(candidate, "hex")
  if (storedBuffer.length === 0 || storedBuffer.length !== candidateBuffer.length) return false
  return timingSafeEqual(storedBuffer, candidateBuffer)
}

/** La contraseña nueva usa scrypt. Las antiguas, en sha256, siguen valiendo hasta el siguiente acceso. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex")
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex")
  return `scrypt:${salt}:${hash}`
}

export function passwordNeedsRehash(stored: string): boolean {
  return !stored.startsWith("scrypt:")
}

export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith("scrypt:")) {
    const [, salt, hash] = stored.split(":")
    if (!salt || !hash) return false
    const candidate = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex")
    return safeEqualHex(hash, candidate)
  }

  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const candidate = createHash("sha256").update(`${salt}:${password}`).digest("hex")
  return safeEqualHex(hash, candidate)
}

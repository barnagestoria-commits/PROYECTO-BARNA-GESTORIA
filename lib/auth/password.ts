import { createHash, randomBytes, timingSafeEqual } from "crypto"

const SALT_LENGTH = 16

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex")
  const hash = createHash("sha256").update(`${salt}:${password}`).digest("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false

  const candidate = createHash("sha256").update(`${salt}:${password}`).digest("hex")
  const hashBuffer = Buffer.from(hash, "hex")
  const candidateBuffer = Buffer.from(candidate, "hex")

  if (hashBuffer.length !== candidateBuffer.length) return false
  return timingSafeEqual(hashBuffer, candidateBuffer)
}

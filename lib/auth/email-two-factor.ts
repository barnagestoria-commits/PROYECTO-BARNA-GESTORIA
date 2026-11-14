import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto"
import { TRUSTED_DEVICE_DAYS } from "@/lib/auth/trusted-device-terms"

export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000
export const EMAIL_CODE_ATTEMPT_LIMIT = 5
export const DEVICE_COOKIE = "taxlyn_device"

export { TRUSTED_DEVICE_ACCEPTANCE, TRUSTED_DEVICE_DAYS, TRUSTED_DEVICE_TERMS_VERSION } from "@/lib/auth/trusted-device-terms"

export function generateEmailCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

export function newDeviceToken(): string {
  return randomBytes(32).toString("hex")
}

function codeSecret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.CERTIFICATE_ENCRYPTION_KEY || "taxlyn-dev-email-code"
}

export function hashEmailCode(code: string): string {
  return createHmac("sha256", codeSecret()).update(code.replace(/\s/g, "")).digest("hex")
}

export function emailCodeMatches(code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashEmailCode(code), "hex")
  const stored = Buffer.from(storedHash, "hex")
  if (candidate.length === 0 || candidate.length !== stored.length) return false
  return timingSafeEqual(candidate, stored)
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function trustedDeviceExpiry(from = new Date()): Date {
  const expires = new Date(from)
  expires.setDate(expires.getDate() + TRUSTED_DEVICE_DAYS)
  return expires
}

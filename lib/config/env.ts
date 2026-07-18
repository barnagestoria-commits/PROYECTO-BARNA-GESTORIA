import { DEFAULT_APP_URL as PLATFORM_DEFAULT_APP_URL } from "@gestoria/platform"

const LOCAL_APP_URL = "http://localhost:3000"
const DEFAULT_APP_URL = PLATFORM_DEFAULT_APP_URL
const PUBLIC_APP_URL_KEY = "NEXT_PUBLIC_APP_URL"

function normalizeUrlInput(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const candidates = trimmed.includes("://")
    ? [trimmed]
    : [`https://${trimmed}`, `http://${trimmed}`]

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate)
      if (url.protocol !== "http:" && url.protocol !== "https:") continue
      return url.origin
    } catch {
      continue
    }
  }

  return null
}

function resolveAppUrl(): string {
  const fromPublic = normalizeUrlInput(process.env[PUBLIC_APP_URL_KEY])
  if (fromPublic) return fromPublic

  const fromNextAuth = normalizeUrlInput(process.env.NEXTAUTH_URL)
  if (fromNextAuth) return fromNextAuth

  const vercelHost = process.env.VERCEL_URL?.trim()
  if (vercelHost) {
    const fromVercel = normalizeUrlInput(`https://${vercelHost}`)
    if (fromVercel) return fromVercel
  }

  return LOCAL_APP_URL
}

function bootstrapUrlEnv(): void {
  const resolved = resolveAppUrl()

  if (!normalizeUrlInput(process.env.NEXTAUTH_URL)) {
    process.env.NEXTAUTH_URL = resolved
  }

  if (!normalizeUrlInput(process.env[PUBLIC_APP_URL_KEY])) {
    process.env[PUBLIC_APP_URL_KEY] = resolved
  }
}

bootstrapUrlEnv()

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",
  appUrl: normalizeUrlInput(process.env[PUBLIC_APP_URL_KEY]) ?? LOCAL_APP_URL,
  nextAuthUrl: normalizeUrlInput(process.env.NEXTAUTH_URL) ?? LOCAL_APP_URL,
} as const

export function getAppUrl(): string {
  return env.appUrl
}

export function getNextAuthUrl(): string {
  return env.nextAuthUrl
}

export function toAbsoluteUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return new URL(normalizedPath, env.appUrl).toString()
}

export { normalizeUrlInput, resolveAppUrl, bootstrapUrlEnv, DEFAULT_APP_URL }

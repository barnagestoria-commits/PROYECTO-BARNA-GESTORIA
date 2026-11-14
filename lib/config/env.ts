import { DEFAULT_APP_URL as PLATFORM_DEFAULT_APP_URL } from "@gestoria/platform"
import { canonicalAppEnv, LOCAL_APP_URL, normalizeUrlInput } from "@/lib/config/app-origin.mjs"

const urls = canonicalAppEnv()
process.env.NEXTAUTH_URL = urls.nextAuthUrl
process.env.NEXT_PUBLIC_APP_URL = urls.appUrl

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",
  appUrl: urls.appUrl,
  nextAuthUrl: urls.nextAuthUrl,
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

export { normalizeUrlInput, LOCAL_APP_URL, PLATFORM_DEFAULT_APP_URL as DEFAULT_APP_URL }

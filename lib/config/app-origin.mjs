export const CANONICAL_PRODUCTION_ORIGIN = "https://taxlyn.com"
export const LOCAL_APP_URL = "http://localhost:3000"
const PRODUCTION_VERCEL_HOST = "v0-factura-y-extractos-web.vercel.app"

export function normalizeUrlInput(value) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const candidates = trimmed.includes("://") ? [trimmed] : [`https://${trimmed}`, `http://${trimmed}`]
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

export function isVercelAppOrigin(origin) {
  if (!origin) return false
  try {
    return new URL(origin).hostname.endsWith(".vercel.app")
  } catch {
    return false
  }
}

function usesCanonicalProduction(source, explicit) {
  if (source.VERCEL_ENV === "preview") return false
  if (source.VERCEL_ENV === "production") return !explicit || isVercelAppOrigin(explicit)
  if (!explicit) return false
  try {
    return new URL(explicit).hostname === PRODUCTION_VERCEL_HOST
  } catch {
    return false
  }
}

export function resolveAppUrl(source = process.env) {
  const explicit =
    normalizeUrlInput(source.NEXT_PUBLIC_APP_URL) || normalizeUrlInput(source.NEXTAUTH_URL)

  if (usesCanonicalProduction(source, explicit)) return CANONICAL_PRODUCTION_ORIGIN
  if (explicit) return explicit

  const vercelHost = source.VERCEL_URL?.trim()
  if (vercelHost) {
    const fromVercel = normalizeUrlInput(`https://${vercelHost}`)
    if (fromVercel) return fromVercel
  }

  return LOCAL_APP_URL
}

export function canonicalAppEnv(source = process.env) {
  const resolved = resolveAppUrl(source)
  const nextAuth = normalizeUrlInput(source.NEXTAUTH_URL)
  const appUrl = normalizeUrlInput(source.NEXT_PUBLIC_APP_URL)
  const replaceVercel = source.VERCEL_ENV === "production" || usesCanonicalProduction(source, nextAuth || appUrl)

  return {
    resolved,
    nextAuthUrl: !nextAuth || (replaceVercel && isVercelAppOrigin(nextAuth)) ? resolved : nextAuth,
    appUrl: !appUrl || (replaceVercel && isVercelAppOrigin(appUrl)) ? resolved : appUrl,
  }
}

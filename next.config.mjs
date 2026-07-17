/** Bootstrap temprano de URLs para next.config (antes de cargar TypeScript). */
const DEFAULT_APP_URL = "http://localhost:3000"
const PUBLIC_APP_URL_KEY = "NEXT_PUBLIC_APP_URL"

function normalizeUrlInput(value) {
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

function resolveAppUrl() {
  const fromPublic = normalizeUrlInput(process.env[PUBLIC_APP_URL_KEY])
  if (fromPublic) return fromPublic
  const fromNextAuth = normalizeUrlInput(process.env.NEXTAUTH_URL)
  if (fromNextAuth) return fromNextAuth
  const vercelHost = process.env.VERCEL_URL?.trim()
  if (vercelHost) {
    const fromVercel = normalizeUrlInput(`https://${vercelHost}`)
    if (fromVercel) return fromVercel
  }
  return DEFAULT_APP_URL
}

const resolved = resolveAppUrl()
if (!normalizeUrlInput(process.env.NEXTAUTH_URL)) {
  process.env.NEXTAUTH_URL = resolved
}
if (!normalizeUrlInput(process.env[PUBLIC_APP_URL_KEY])) {
  process.env[PUBLIC_APP_URL_KEY] = resolved
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdfmake", "exceljs", "xlsx"],
    instrumentationHook: true,
  },
  async rewrites() {
    // NextAuth está en /api/oauth; Azure/Google a veces redirigen al path por defecto /api/auth/*
    return [
      { source: "/api/auth/callback/:provider", destination: "/api/oauth/callback/:provider" },
      { source: "/api/auth/signin/:provider", destination: "/api/oauth/signin/:provider" },
      { source: "/api/auth/signin", destination: "/api/oauth/signin" },
      { source: "/api/auth/error", destination: "/api/oauth/error" },
      { source: "/api/auth/csrf", destination: "/api/oauth/csrf" },
      { source: "/api/auth/providers", destination: "/api/oauth/providers" },
    ]
  },
}

export default nextConfig

/**
 * Variables expuestas al cliente (prefijo NEXT_PUBLIC_*).
 * Nunca importar secretos OAuth ni API keys aquí.
 */

const LOCAL_APP_URL = "http://localhost:3000"

function normalizeOrigin(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return LOCAL_APP_URL

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
    return url.origin
  } catch {
    return LOCAL_APP_URL
  }
}

/** URL pública de la app — segura para componentes cliente y shells móviles. */
export const publicEnv = {
  appUrl: normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL),
} as const

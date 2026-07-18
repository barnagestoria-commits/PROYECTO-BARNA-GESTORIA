/** URL cloud por defecto hasta tener dominio de marca propio. */
export const DEFAULT_APP_URL = "https://v0-factura-y-extractos-web.vercel.app"

function normalizeOrigin(value: string): string {
  return value.replace(/\/$/, "")
}

/**
 * URL base de la aplicación web en la nube.
 * Prioridad: NEXT_PUBLIC_APP_URL → inyección en shell → Vercel producción.
 */
export function getCloudAppUrl(): string {
  const fromEnv =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_APP_URL?.trim() : undefined
  if (fromEnv) return normalizeOrigin(fromEnv)

  if (typeof window !== "undefined") {
    const injected = (window as Window & { __GESTORIA_APP_URL__?: string }).__GESTORIA_APP_URL__
    if (injected?.trim()) return normalizeOrigin(injected)
  }

  return DEFAULT_APP_URL
}

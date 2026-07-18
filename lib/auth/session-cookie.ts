import { env } from "@/lib/config/env"

export const SESSION_COOKIE = "barna_session"
export const SESSION_DAYS = 7

/**
 * Opciones de cookie de sesión de plataforma (token opaco en servidor).
 * - httpOnly: no accesible desde JS del cliente (requisito App Store / Play Store).
 * - secure: solo HTTPS en producción.
 * - sameSite=lax: compatible con OAuth redirect y WebView Capacitor en mismo dominio.
 */
export function getSessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.isProduction,
    path: "/",
    expires,
  }
}

export function getSessionExpiry(): Date {
  const expires = new Date()
  expires.setDate(expires.getDate() + SESSION_DAYS)
  return expires
}

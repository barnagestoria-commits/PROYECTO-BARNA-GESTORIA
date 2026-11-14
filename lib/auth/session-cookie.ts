import { env } from "@/lib/config/env"

import { OPERATOR_SESSION_HOURS } from "@/lib/auth/login-guard"

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

export function getSessionExpiry(forOperator = false): Date {
  const expires = new Date()
  if (forOperator) {
    expires.setHours(expires.getHours() + OPERATOR_SESSION_HOURS)
    return expires
  }
  expires.setDate(expires.getDate() + SESSION_DAYS)
  return expires
}

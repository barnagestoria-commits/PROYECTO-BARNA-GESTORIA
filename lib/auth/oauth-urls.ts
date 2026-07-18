import { env } from "@/lib/config/env"
import { NEXTAUTH_BASE_PATH } from "@/lib/auth/oauth-config"

export const LEGAL_PATHS = {
  privacyPolicy: "/politica-privacidad",
  termsOfService: "/terminos-servicio",
} as const

/** Origen canónico para OAuth (NEXTAUTH_URL → NEXT_PUBLIC_APP_URL → Vercel). */
export function getProductionOrigin(): string {
  return env.nextAuthUrl
}

export function getOAuthCallbackUrl(provider: "google" | "azure-ad"): string {
  return `${getProductionOrigin()}${NEXTAUTH_BASE_PATH}/callback/${provider}`
}

/** Compatibilidad con el path por defecto de NextAuth (/api/auth/* rewrites). */
export function getLegacyOAuthCallbackUrl(provider: "google" | "azure-ad"): string {
  return `${getProductionOrigin()}/api/auth/callback/${provider}`
}

export function getOAuthRedirectUris() {
  const origin = getProductionOrigin()

  return {
    origin,
    nextAuthCallbacks: {
      google: getOAuthCallbackUrl("google"),
      azureAd: getOAuthCallbackUrl("azure-ad"),
    },
    legacyCallbacks: {
      google: getLegacyOAuthCallbackUrl("google"),
      azureAd: getLegacyOAuthCallbackUrl("azure-ad"),
    },
    postLogin: `${origin}/auth/complete`,
    privacyPolicy: `${origin}${LEGAL_PATHS.privacyPolicy}`,
    termsOfService: `${origin}${LEGAL_PATHS.termsOfService}`,
  }
}

export function getOAuthProductionWarnings(): string[] {
  const warnings: string[] = []
  const origin = getProductionOrigin()

  if (env.isProduction && /localhost|127\.0\.0\.1/i.test(origin)) {
    warnings.push(
      "NEXTAUTH_URL apunta a localhost en producción. Configura el dominio definitivo en Vercel.",
    )
  }

  if (env.isProduction && origin.startsWith("http://") && !origin.includes("localhost")) {
    warnings.push("NEXTAUTH_URL usa HTTP en producción. Debe ser HTTPS.")
  }

  return warnings
}

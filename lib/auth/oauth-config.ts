/** Configuración OAuth — activar providers pegando credenciales en .env.local */

import { env } from "@/lib/config/env"

export const NEXTAUTH_BASE_PATH = "/api/oauth"

export function getAzureTenantId(): string {
  return process.env.AZURE_AD_TENANT_ID?.trim() || "common"
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim())
}

export function isOutlookOAuthConfigured(): boolean {
  return Boolean(
    process.env.AZURE_AD_CLIENT_ID?.trim() && process.env.AZURE_AD_CLIENT_SECRET?.trim(),
  )
}

export function isNextAuthConfigured(): boolean {
  return Boolean(process.env.NEXTAUTH_SECRET?.trim() && env.nextAuthUrl)
}

export function getOAuthStatus() {
  return {
    nextAuth: isNextAuthConfigured(),
    google: isGoogleOAuthConfigured(),
    outlook: isOutlookOAuthConfigured(),
  }
}

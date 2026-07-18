/** Configuración OAuth — activar providers pegando credenciales en .env.local */

import { env } from "@/lib/config/env"
import {
  getOAuthProductionWarnings,
  getOAuthRedirectUris,
  LEGAL_PATHS,
} from "@/lib/auth/oauth-urls"

export const NEXTAUTH_BASE_PATH = "/api/oauth"
export { LEGAL_PATHS }

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

/** Metadatos públicos para registrar URIs en Google Cloud y Microsoft Entra (sin secretos). */
export function getOAuthSetupInfo() {
  const redirectUris = getOAuthRedirectUris()
  const azureClientId = process.env.AZURE_AD_CLIENT_ID?.trim() || null

  return {
    ...getOAuthStatus(),
    productionOrigin: redirectUris.origin,
    redirectUris: {
      google: {
        primary: redirectUris.nextAuthCallbacks.google,
        legacy: redirectUris.legacyCallbacks.google,
      },
      outlook: {
        primary: redirectUris.nextAuthCallbacks.azureAd,
        legacy: redirectUris.legacyCallbacks.azureAd,
      },
      postLogin: redirectUris.postLogin,
    },
    legalUrls: {
      privacyPolicy: redirectUris.privacyPolicy,
      termsOfService: redirectUris.termsOfService,
    },
    microsoftEntra: {
      applicationId: azureClientId,
      tenantId: getAzureTenantId(),
      publisherVerificationRequired: true,
      partnerCenterUrl:
        "https://partner.microsoft.com/dashboard/v2/enrollment/introduction/partnership",
      documentationPath: "docs/OAUTH_PRODUCTION.md",
    },
    warnings: getOAuthProductionWarnings(),
  }
}

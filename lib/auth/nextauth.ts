import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import AzureADProvider from "next-auth/providers/azure-ad"
import { env } from "@/lib/config/env"
import {
  isGoogleOAuthConfigured,
  isOutlookOAuthConfigured,
  NEXTAUTH_BASE_PATH,
} from "@/lib/auth/oauth-config"

function buildProviders() {
  const providers: NextAuthOptions["providers"] = []

  if (isGoogleOAuthConfigured()) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    )
  }

  if (isOutlookOAuthConfigured()) {
    providers.push(
      AzureADProvider({
        clientId: process.env.AZURE_AD_CLIENT_ID!,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
        tenantId: process.env.AZURE_AD_TENANT_ID!,
      }),
    )
  }

  return providers
}

/**
 * Configuración NextAuth para OAuth social (Google / Outlook).
 * Montada en /api/oauth para no colisionar con /api/auth/* (login por credenciales).
 *
 * Cuando conectes cuentas reales, vincula el perfil OAuth con User/Account en Prisma
 * dentro del callback signIn o jwt.
 */
export const authOptions: NextAuthOptions = {
  providers: buildProviders(),
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn() {
      // TODO: vincular email OAuth con User en Prisma y crear sesión de plataforma
      return true
    },
    async redirect({ url, baseUrl }) {
      const origin = baseUrl || env.nextAuthUrl
      if (url.startsWith("/")) return `${origin}${url}`
      try {
        if (new URL(url).origin === origin) return url
      } catch {
        // URL externa o mal formada: volver al panel
      }
      return `${origin}/dashboard`
    },
  },
  debug: process.env.NODE_ENV === "development",
}

export { NEXTAUTH_BASE_PATH }

"use client"

import { useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { GoogleIcon } from "@/components/icons/google-icon"
import { MicrosoftIcon } from "@/components/icons/microsoft-icon"
import { apiFetch } from "@/lib/api-client"

interface OAuthStatus {
  nextAuth: boolean
  google: boolean
  outlook: boolean
}

export function SocialLoginButtons() {
  const [status, setStatus] = useState<OAuthStatus | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<OAuthStatus>("/api/auth/oauth-status")
      .then(setStatus)
      .catch(() => setStatus({ nextAuth: false, google: false, outlook: false }))
  }, [])

  const handleOAuth = async (provider: "google" | "azure-ad", label: string, enabled: boolean) => {
    setMessage(null)

    if (!enabled) {
      setMessage(
        `${label} estará disponible en cuanto configures las credenciales OAuth en .env.local (ver .env.example).`,
      )
      return
    }

    setLoadingProvider(provider)
    try {
      await signIn(provider, { callbackUrl: "/dashboard" })
    } finally {
      setLoadingProvider(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <span className="w-full border-t border-sand-300" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-graphite-500">O continúa con</span>
        </div>
      </div>

      <div className="grid gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-center gap-3 border-sand-300 bg-white font-normal text-graphite-800 hover:bg-sand-50"
          onClick={() => handleOAuth("google", "Google", status?.google ?? false)}
          disabled={loadingProvider !== null}
          aria-describedby={message ? "oauth-message" : undefined}
        >
          <GoogleIcon className="h-5 w-5" />
          {loadingProvider === "google" ? "Conectando..." : "Iniciar sesión con Google"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-center gap-3 border-sand-300 bg-white font-normal text-graphite-800 hover:bg-sand-50"
          onClick={() => handleOAuth("azure-ad", "Outlook", status?.outlook ?? false)}
          disabled={loadingProvider !== null}
          aria-describedby={message ? "oauth-message" : undefined}
        >
          <MicrosoftIcon className="h-5 w-5" />
          {loadingProvider === "azure-ad" ? "Conectando..." : "Iniciar sesión con Outlook"}
        </Button>
      </div>

      {message && (
        <p id="oauth-message" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {message}
        </p>
      )}
    </div>
  )
}

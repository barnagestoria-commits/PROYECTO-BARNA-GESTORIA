import { describe, expect, it } from "vitest"
import { canonicalAppEnv, resolveAppUrl } from "@/lib/config/app-origin.mjs"

describe("origen público", () => {
  it("en producción sustituye el dominio de Vercel por taxlyn.com", () => {
    const source = {
      VERCEL_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://v0-factura-y-extractos-web.vercel.app",
      NEXTAUTH_URL: "https://v0-factura-y-extractos-web.vercel.app",
      VERCEL_URL: "v0-factura-y-extractos-web-abc.vercel.app",
    }
    expect(resolveAppUrl(source)).toBe("https://taxlyn.com")
    expect(canonicalAppEnv(source)).toEqual({
      resolved: "https://taxlyn.com",
      nextAuthUrl: "https://taxlyn.com",
      appUrl: "https://taxlyn.com",
    })
  })

  it("conserva el dominio de una vista previa", () => {
    const source = {
      VERCEL_ENV: "preview",
      VERCEL_URL: "proyecto-barna-git-preview.vercel.app",
    }
    expect(resolveAppUrl(source)).toBe("https://proyecto-barna-git-preview.vercel.app")
  })

  it("en local mantiene localhost", () => {
    const source = {
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXTAUTH_URL: "http://localhost:3000",
    }
    expect(resolveAppUrl(source)).toBe("http://localhost:3000")
  })
})

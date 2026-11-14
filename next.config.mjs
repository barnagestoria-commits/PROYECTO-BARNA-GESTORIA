/** Bootstrap temprano de URLs para next.config (antes de cargar TypeScript). */
import { canonicalAppEnv } from "./lib/config/app-origin.mjs"

const urls = canonicalAppEnv()
process.env.NEXTAUTH_URL = urls.nextAuthUrl
process.env.NEXT_PUBLIC_APP_URL = urls.appUrl

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@gestoria/platform"],
  images: {
    unoptimized: true,
  },
  experimental: {
    middlewareClientMaxBodySize: "50mb",
  },
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "pdfmake",
    "exceljs",
    "xlsx",
  ],
  async rewrites() {
    // NextAuth está en /api/oauth; Azure/Google a veces redirigen al path por defecto /api/auth/*
    return [
      { source: "/api/auth/callback/:provider", destination: "/api/oauth/callback/:provider" },
      { source: "/api/auth/signin/:provider", destination: "/api/oauth/signin/:provider" },
      { source: "/api/auth/signin", destination: "/api/oauth/signin" },
      { source: "/api/auth/error", destination: "/api/oauth/error" },
      { source: "/api/auth/csrf", destination: "/api/oauth/csrf" },
      { source: "/api/auth/providers", destination: "/api/oauth/providers" },
    ]
  },
}

export default nextConfig

import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { env } from "@/lib/config/env"
import { AppWrapper } from "@/components/app-wrapper"
import { ChatProvider } from "@/components/chat-provider"
import { AuthProvider } from "@/components/auth-provider"
import { NextAuthProvider } from "@/components/next-auth-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: "Barna Gestoría - Contable, Fiscal y Laboral",
  description:
    "Servicios de gestoría en Barcelona para empresas y autónomos. Gestión contable, fiscal y laboral profesional.",
  keywords: "gestoría, Barcelona, contable, fiscal, laboral, empresas, autónomos",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AppWrapper>
          <NextAuthProvider>
            <AuthProvider>
              <ChatProvider>{children}</ChatProvider>
            </AuthProvider>
          </NextAuthProvider>
        </AppWrapper>
      </body>
    </html>
  )
}

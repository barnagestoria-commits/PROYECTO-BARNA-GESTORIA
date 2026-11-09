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
  title: "Taxlyn · Programa de gestión contable y fiscal",
  description:
    "Taxlyn es el programa de gestión contable y fiscal para empresas, autónomos y despachos.",
  keywords: "Taxlyn, programa de gestión, contabilidad, fiscal, empresas, autónomos, despachos",
  icons: {
    icon: "/brand/taxlyn-perfil-400.png",
    apple: "/brand/taxlyn-redes-1080.png",
  },
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="max-w-full">
      <body className={`${inter.className} max-w-full`}>
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

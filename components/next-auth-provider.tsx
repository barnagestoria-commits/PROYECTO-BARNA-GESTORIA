"use client"

import { SessionProvider } from "next-auth/react"
import { NEXTAUTH_BASE_PATH } from "@/lib/auth/oauth-config"
import type { ReactNode } from "react"

export function NextAuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider basePath={NEXTAUTH_BASE_PATH}>
      {children}
    </SessionProvider>
  )
}

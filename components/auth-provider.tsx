"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import type { AccountType, AuthSession, RegisterRequest } from "@/lib/types/auth"
import { getPanelTitle, getRoleLabel } from "@/lib/auth/permissions"
import { apiFetch, type SessionResponse } from "@/lib/api-client"

interface AuthContextValue {
  session: AuthSession | null
  isLoading: boolean
  panelTitle: string
  roleLabel: string
  activeCompany: AuthSession["companies"][number] | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  setActiveCompany: (companyId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiFetch<SessionResponse>("/api/auth/session")
      setSession(data.session)
    } catch {
      setSession(null)
    }
  }, [])

  useEffect(() => {
    refreshSession().finally(() => setIsLoading(false))
  }, [refreshSession])

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<SessionResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
      setSession(data.session)
      router.push("/dashboard")
    },
    [router],
  )

  const register = useCallback(
    async (payload: RegisterRequest) => {
      const data = await apiFetch<SessionResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      setSession(data.session)
      router.push("/dashboard")
    },
    [router],
  )

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/session", { method: "POST" })
    setSession(null)
    router.push("/login")
  }, [router])

  const setActiveCompany = useCallback(async (companyId: string) => {
    const data = await apiFetch<SessionResponse>("/api/auth/active-company", {
      method: "PATCH",
      body: JSON.stringify({ companyId }),
    })
    setSession(data.session)
  }, [])

  const activeCompany = useMemo(() => {
    if (!session?.activeCompanyId) return null
    return session.companies.find((company) => company.id === session.activeCompanyId) ?? null
  }, [session])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      panelTitle: session ? getPanelTitle(session) : "Panel",
      roleLabel: session ? getRoleLabel(session.user.role) : "",
      activeCompany,
      login,
      register,
      logout,
      refreshSession,
      setActiveCompany,
    }),
    [session, isLoading, activeCompany, login, register, logout, refreshSession, setActiveCompany],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.")
  }
  return context
}

export function useRequireAuth(redirectTo = "/login"): AuthContextValue {
  const auth = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!auth.isLoading && !auth.session) {
      router.replace(redirectTo)
    }
  }, [auth.isLoading, auth.session, router, redirectTo])

  return auth
}

export type { AccountType, RegisterRequest }

"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api-client"
import type { AccountType } from "@/lib/types/auth"
import type { SupportDirectoryAccount } from "@/lib/auth/support-directory"

function accountTypeLabel(accountType: AccountType): string {
  if (accountType === "GESTORIA") return "Despacho"
  if (accountType === "EMPRESA") return "Empresa"
  return "Autónomo"
}

export function SupportAccountsWorkspace() {
  const { session, isLoading, refreshSession } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [accounts, setAccounts] = useState<SupportDirectoryAccount[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enteringId, setEnteringId] = useState<string | null>(null)

  const load = useCallback(async (nextQuery: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (nextQuery.trim()) params.set("q", nextQuery.trim())
      const data = await apiFetch<{
        accounts: SupportDirectoryAccount[]
        truncated: boolean
      }>(`/api/support/accounts?${params.toString()}`)
      setAccounts(data.accounts)
      setTruncated(data.truncated)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido cargar el listado.")
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLoading || !session?.user.isPlatformOperator) return
    const handle = window.setTimeout(() => {
      void load(query)
    }, 250)
    return () => window.clearTimeout(handle)
  }, [isLoading, session?.user.isPlatformOperator, query, load])

  async function enterCompany(companyId: string) {
    setEnteringId(companyId)
    setError(null)
    try {
      await apiFetch("/api/support/enter", {
        method: "POST",
        body: JSON.stringify({ companyId }),
      })
      await refreshSession()
      router.push("/dashboard")
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido entrar en la empresa.")
      setEnteringId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    )
  }

  if (!session?.user.isPlatformOperator) {
    return (
      <p className="rounded-xl border border-sand-200 bg-white p-4 text-sm text-graphite-600">
        Esta pantalla es solo para el operador de Taxlyn.
      </p>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <p className="text-sm text-graphite-600">
        Entras en cualquier empresa dada de alta para resolver una incidencia o presentar sus impuestos con el certificado de esa empresa.
      </p>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, email o NIF"
          className="h-12 w-full rounded-xl border border-sand-300 bg-white pl-10 pr-3 text-base text-pine-950 outline-none ring-emerald-700/30 focus:ring-2"
        />
      </label>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
        </div>
      ) : accounts.length === 0 ? (
        <p className="rounded-xl border border-sand-200 bg-white p-4 text-sm text-graphite-600">
          No hay cuentas con ese criterio.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {accounts.map((account) => (
            <li key={account.userId} className="rounded-2xl border border-sand-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-pine-950">{account.name}</p>
                <p className="text-xs uppercase tracking-wide text-graphite-500">
                  {accountTypeLabel(account.accountType)}
                </p>
              </div>
              <p className="mt-1 text-sm text-graphite-600">{account.email}</p>
              {account.accountName !== account.name ? (
                <p className="text-sm text-graphite-500">{account.accountName}</p>
              ) : null}
              <ul className="mt-3 flex flex-col gap-2">
                {account.companies.map((company) => (
                  <li
                    key={company.id}
                    className="flex flex-col gap-2 rounded-xl bg-sand-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-pine-900">{company.name}</p>
                      <p className="text-xs text-graphite-500">{company.cif || "Sin NIF"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void enterCompany(company.id)}
                      disabled={enteringId === company.id}
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
                    >
                      {enteringId === company.id ? "Entrando…" : "Entrar"}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {truncated ? (
        <p className="text-xs text-graphite-500">
          Hay más cuentas. Afina la búsqueda por nombre, email o NIF.
        </p>
      ) : null}
    </div>
  )
}

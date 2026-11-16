"use client"

import { useCallback, useEffect, useState } from "react"
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
  const { session, isLoading } = useAuth()
  const [query, setQuery] = useState("")
  const [accounts, setAccounts] = useState<SupportDirectoryAccount[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [blockedUsers, setBlockedUsers] = useState(0)
  const [demoAccounts, setDemoAccounts] = useState(0)
  const [removingDemo, setRemovingDemo] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enteringId, setEnteringId] = useState<string | null>(null)
  const [operatorPassword, setOperatorPassword] = useState("")
  const [setupOpen, setSetupOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordChallengeId, setPasswordChallengeId] = useState<string | null>(null)
  const [passwordCode, setPasswordCode] = useState("")
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)
  const [blockingId, setBlockingId] = useState<string | null>(null)
  const [reasonByUser, setReasonByUser] = useState<Record<string, string>>({})

  const load = useCallback(async (nextQuery: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (nextQuery.trim()) params.set("q", nextQuery.trim())
      const data = await apiFetch<{
        accounts: SupportDirectoryAccount[]
        truncated: boolean
        totalUsers: number
        blockedUsers: number
        demoAccounts: number
      }>(`/api/support/accounts?${params.toString()}`)
      setAccounts(data.accounts)
      setTruncated(data.truncated)
      setTotalUsers(data.totalUsers)
      setBlockedUsers(data.blockedUsers)
      setDemoAccounts(data.demoAccounts)
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

  async function setBlocked(account: SupportDirectoryAccount, blocked: boolean) {
    setBlockingId(account.userId)
    setError(null)
    try {
      await apiFetch("/api/support/block", {
        method: "POST",
        body: JSON.stringify({
          userId: account.userId,
          blocked,
          reason: reasonByUser[account.userId] ?? "",
        }),
      })
      await load(query)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido cambiar el acceso.")
    } finally {
      setBlockingId(null)
    }
  }

  async function removeDemo() {
    const confirmed = window.confirm(
      "Se borrarán las cuentas de ejemplo (juan@empresa.com, gestor@gestoria.com y admin@gestoria.com) con sus datos de prueba. No afecta a clientes reales. ¿Continuar?",
    )
    if (!confirmed) return
    setRemovingDemo(true)
    setError(null)
    try {
      await apiFetch("/api/support/demo-accounts", { method: "POST" })
      await load(query)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se han podido borrar las cuentas de ejemplo.")
    } finally {
      setRemovingDemo(false)
    }
  }

  async function sendPasswordCode() {
    setError(null)
    setPasswordNotice(null)
    if (newPassword.length < 8) {
      setError("La contraseña nueva debe tener al menos 8 caracteres.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Las dos contraseñas no coinciden.")
      return
    }
    setPasswordBusy(true)
    try {
      const data = await apiFetch<{ challengeId: string }>("/api/auth/operator-password/code", {
        method: "POST",
      })
      setPasswordChallengeId(data.challengeId)
      setPasswordNotice(`Te hemos enviado un código a ${session?.user.email}. Escríbelo para guardar la contraseña.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido enviar el código.")
    } finally {
      setPasswordBusy(false)
    }
  }

  async function saveOperatorPassword() {
    if (!passwordChallengeId) return
    setError(null)
    setPasswordNotice(null)
    if (newPassword.length < 8) {
      setError("La contraseña nueva debe tener al menos 8 caracteres.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Las dos contraseñas no coinciden.")
      return
    }
    setPasswordBusy(true)
    try {
      await apiFetch("/api/auth/operator-password", {
        method: "POST",
        body: JSON.stringify({
          challengeId: passwordChallengeId,
          code: passwordCode,
          password: newPassword,
        }),
      })
      setOperatorPassword(newPassword)
      setNewPassword("")
      setConfirmPassword("")
      setPasswordCode("")
      setPasswordChallengeId(null)
      setSetupOpen(false)
      setPasswordNotice("Contraseña guardada. Ya puedes usarla para entrar en un cliente.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido guardar la contraseña.")
    } finally {
      setPasswordBusy(false)
    }
  }

  async function enterCompany(companyId: string) {
    if (!operatorPassword) {
      setError("Escribe arriba la contraseña del operador para poder entrar en un cliente.")
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    setEnteringId(companyId)
    setError(null)
    // Si el servidor no contesta, el botón no se queda en "Entrando…" para siempre.
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20_000)
    try {
      await apiFetch("/api/support/enter", {
        method: "POST",
        body: JSON.stringify({ companyId, password: operatorPassword }),
        signal: controller.signal,
      })
      // Carga completa: la sesión ya apunta a la empresa del cliente y no queda estado viejo en pantalla.
      window.location.assign("/dashboard")
    } catch (cause) {
      const timedOut = cause instanceof DOMException && cause.name === "AbortError"
      setError(
        timedOut
          ? "El servidor tardó demasiado en responder. Vuelve a intentarlo."
          : cause instanceof Error
            ? cause.message
            : "No se ha podido entrar en la empresa.",
      )
      setEnteringId(null)
      // El aviso está arriba del listado; si estabas más abajo no lo verías.
      window.scrollTo({ top: 0, behavior: "smooth" })
    } finally {
      window.clearTimeout(timeout)
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
        {loading
          ? "Cargando el censo…"
          : `${totalUsers} ${totalUsers === 1 ? "usuario dado de alta" : "usuarios dados de alta"}. ${blockedUsers} con el acceso bloqueado.`}{" "}
        Desde aquí entras en una empresa para una incidencia, o bloqueas el acceso por mal uso o por la suscripción.
      </p>

      {demoAccounts > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Hay {demoAccounts} {demoAccounts === 1 ? "cuenta de ejemplo" : "cuentas de ejemplo"} que no son clientes reales.
            No salen en este listado, pero conviene borrarlas: tienen una contraseña de prueba conocida.
          </p>
          <button
            type="button"
            onClick={() => void removeDemo()}
            disabled={removingDemo}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-amber-900 px-4 font-semibold text-white hover:bg-amber-950 disabled:opacity-60"
          >
            {removingDemo ? "Borrando…" : "Borrar cuentas de ejemplo"}
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label className="block text-sm text-graphite-700">
          Contraseña del operador
          <input
            type="password"
            value={operatorPassword}
            onChange={(event) => setOperatorPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="Hace falta para entrar en un cliente"
            className="mt-1 h-12 w-full rounded-xl border border-sand-300 bg-white px-3 text-base text-pine-950 outline-none ring-emerald-700/30 focus:ring-2"
          />
        </label>
        <p className="text-xs text-graphite-600">
          Si entraste con Google, no elegiste esta contraseña. Créala aquí y confírmala con un código a {session.user.email}.
        </p>
        <button
          type="button"
          onClick={() => {
            setSetupOpen((open) => !open)
            setError(null)
          }}
          className="self-start text-sm font-medium text-emerald-800 underline"
        >
          {setupOpen ? "Cerrar" : "Crear o cambiar la contraseña"}
        </button>
        {setupOpen ? (
          <div className="flex flex-col gap-3 rounded-xl border border-sand-300 bg-white p-3">
            <label className="block text-sm text-graphite-700">
              Contraseña nueva
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                className="mt-1 h-12 w-full rounded-xl border border-sand-300 bg-white px-3 text-base text-pine-950 outline-none ring-emerald-700/30 focus:ring-2"
              />
            </label>
            <label className="block text-sm text-graphite-700">
              Repite la contraseña
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                className="mt-1 h-12 w-full rounded-xl border border-sand-300 bg-white px-3 text-base text-pine-950 outline-none ring-emerald-700/30 focus:ring-2"
              />
            </label>
            {passwordChallengeId ? (
              <label className="block text-sm text-graphite-700">
                Código del correo
                <input
                  value={passwordCode}
                  onChange={(event) => setPasswordCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="mt-1 h-12 w-full rounded-xl border border-sand-300 bg-white px-3 text-base text-pine-950 outline-none ring-emerald-700/30 focus:ring-2"
                />
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => void (passwordChallengeId ? saveOperatorPassword() : sendPasswordCode())}
              disabled={passwordBusy}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-pine-900 disabled:opacity-60"
            >
              {passwordBusy
                ? "Enviando…"
                : passwordChallengeId
                  ? "Guardar contraseña"
                  : "Enviar código al correo"}
            </button>
          </div>
        ) : null}
        {passwordNotice ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {passwordNotice}
          </p>
        ) : null}
      </div>

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
              <p className="text-xs text-graphite-500">
                Alta el {new Date(account.createdAt).toLocaleDateString("es-ES")}
                {account.blocked ? " · Acceso bloqueado" : ""}
                {account.blockReason ? ` · ${account.blockReason}` : ""}
              </p>
              {account.email.toLowerCase() === session.user.email.toLowerCase() ? null : (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {account.blocked ? null : (
                    <input
                      value={reasonByUser[account.userId] ?? ""}
                      onChange={(event) =>
                        setReasonByUser((current) => ({ ...current, [account.userId]: event.target.value }))
                      }
                      placeholder="Motivo, si quieres dejarlo anotado"
                      className="h-10 min-w-0 flex-1 rounded-lg border border-sand-300 bg-white px-3 text-sm text-pine-950 outline-none ring-emerald-700/30 focus:ring-2"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => void setBlocked(account, !account.blocked)}
                    disabled={blockingId === account.userId}
                    className={
                      account.blocked
                        ? "inline-flex h-10 items-center justify-center rounded-lg border border-emerald-800 px-4 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60"
                        : "inline-flex h-10 items-center justify-center rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60"
                    }
                  >
                    {blockingId === account.userId
                      ? "Guardando…"
                      : account.blocked
                        ? "Devolver el acceso"
                        : "Bloquear acceso"}
                  </button>
                </div>
              )}
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

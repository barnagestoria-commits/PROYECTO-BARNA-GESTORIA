"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRightLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { TransferMovementsDialog } from "@/components/accounting/transfer-movements-dialog"
import { apiFetch } from "@/lib/api-client"
import { formatEuro } from "@/lib/accounting/command-templates"
import {
  buildPunteoBalances,
  lineVisibleInPunteo,
  movePunteoAccount,
  parsePunteoAmount,
  type PunteoAccountOption,
  type PunteoFilter,
  type PunteoMove,
  type PunteoWindow,
} from "@/lib/accounting/account-punteo"
import type { AccountMovementsSummary } from "@/lib/accounting/account-movements-service"
import { normalizeCuenta } from "@/lib/reports/format"

interface AccountMovementsDialogProps {
  open: boolean
  cuenta: string | null
  year?: number
  refreshKey?: number
  startPunteo?: boolean
  onClose: () => void
  onBack?: () => void
  onCuentaChange?: (cuenta: string) => void
  onOpenEntry?: (entryId: string) => void
  onEntryDeleted?: () => void
  onEditAccount?: (accountCode: string, accountName: string) => void
  onReleaseAccount?: (accountCode: string, accountName: string) => void
  onChanged?: () => void
}

const FILTERS: Array<{ id: PunteoFilter; label: string }> = [
  { id: "no-punteados", label: "No punteados" },
  { id: "punteados", label: "Punteados" },
  { id: "ambos", label: "Ambos" },
]

export function AccountMovementsDialog({
  open,
  cuenta,
  year = new Date().getFullYear(),
  refreshKey = 0,
  startPunteo = false,
  onClose,
  onBack,
  onCuentaChange,
  onOpenEntry,
  onEntryDeleted,
  onEditAccount,
  onReleaseAccount,
  onChanged,
}: AccountMovementsDialogProps) {
  const [summary, setSummary] = useState<AccountMovementsSummary | null>(null)
  const [accounts, setAccounts] = useState<PunteoAccountOption[]>([])
  const [accountsYear, setAccountsYear] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [localRefresh, setLocalRefresh] = useState(0)
  const [accountRefresh, setAccountRefresh] = useState(0)
  const [punteoMode, setPunteoMode] = useState(false)
  const [filter, setFilter] = useState<PunteoFilter>("ambos")
  const [fromDate, setFromDate] = useState(`${year}-01-01`)
  const [toDate, setToDate] = useState(`${year}-12-31`)
  const [fromAmount, setFromAmount] = useState("")
  const [toAmount, setToAmount] = useState("")
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const sessionReady = useRef(false)
  const pickedAccount = useRef(false)

  useEffect(() => {
    setFromDate(`${year}-01-01`)
    setToDate(`${year}-12-31`)
  }, [year])

  useEffect(() => {
    if (!open) {
      sessionReady.current = false
      pickedAccount.current = false
      setSummary(null)
      setError(null)
      setTransferOpen(false)
      setPendingIds([])
      setActionError(null)
      setAccountsError(null)
      return
    }
    if (sessionReady.current) return
    sessionReady.current = true
    setPunteoMode(startPunteo)
    setFilter(startPunteo ? "no-punteados" : "ambos")
    setFromAmount("")
    setToAmount("")
  }, [open, startPunteo])

  const punteoWindow = useMemo<PunteoWindow>(() => {
    if (!punteoMode) {
      return {
        fromDate: `${year}-01-01`,
        toDate: `${year}-12-31`,
        fromAmount: 0,
        toAmount: 0,
      }
    }
    return {
      fromDate: /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? fromDate : `${year}-01-01`,
      toDate: /^\d{4}-\d{2}-\d{2}$/.test(toDate) ? toDate : `${year}-12-31`,
      fromAmount: parsePunteoAmount(fromAmount),
      toAmount: parsePunteoAmount(toAmount),
    }
  }, [fromAmount, fromDate, punteoMode, toAmount, toDate, year])

  const [accountQuery, setAccountQuery] = useState(punteoWindow)
  useEffect(() => {
    const timer = window.setTimeout(() => setAccountQuery(punteoWindow), 300)
    return () => window.clearTimeout(timer)
  }, [punteoWindow])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setIsLoadingAccounts(true)
    setAccountsYear(null)
    const params = new URLSearchParams({
      year: String(year),
      from: accountQuery.fromDate,
      to: accountQuery.toDate,
    })
    if (accountQuery.fromAmount > 0) params.set("min", String(accountQuery.fromAmount))
    if (accountQuery.toAmount > 0) params.set("max", String(accountQuery.toAmount))

    apiFetch<{ success: true; accounts: PunteoAccountOption[] }>(
      `/api/accounting/punteo?${params.toString()}`,
    )
      .then((data) => {
        if (!cancelled) {
          setAccounts(data.accounts)
          setAccountsYear(year)
          setAccountsError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAccounts([])
          setAccountsYear(year)
          setAccountsError(err instanceof Error ? err.message : "No se pudo cargar el listado de cuentas.")
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAccounts(false)
      })

    return () => {
      cancelled = true
    }
  }, [accountQuery, accountRefresh, open, year])

  useEffect(() => {
    if (!open || cuenta || !startPunteo || pickedAccount.current || accountsYear !== year || accounts.length === 0) return
    const first =
      movePunteoAccount(accounts, "", "first", "no-punteados") ??
      movePunteoAccount(accounts, "", "first", "ambos")
    if (!first || !onCuentaChange) return
    pickedAccount.current = true
    onCuentaChange(first)
  }, [accounts, accountsYear, cuenta, onCuentaChange, open, startPunteo, year])

  useEffect(() => {
    if (!open || !cuenta) {
      if (!cuenta) setSummary(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    apiFetch<{ success: true; summary: AccountMovementsSummary }>(
      `/api/accounting/account-movements?cuenta=${encodeURIComponent(cuenta)}&year=${year}`,
    )
      .then((data) => {
        if (!cancelled) setSummary(data.summary)
      })
      .catch((err) => {
        if (!cancelled) {
          setSummary(null)
          setError(err instanceof Error ? err.message : "No se pudieron cargar los movimientos.")
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [cuenta, open, refreshKey, year, localRefresh])

  const activeFilter: PunteoFilter = punteoMode ? filter : "ambos"
  const currentAccount = useMemo(
    () => accounts.find((account) => normalizeCuenta(account.cuenta) === normalizeCuenta(cuenta ?? summary?.cuenta ?? "")),
    [accounts, cuenta, summary?.cuenta],
  )

  const goToAccount = useCallback(
    (direction: PunteoMove) => {
      const next = movePunteoAccount(
        accounts,
        summary?.cuenta ?? cuenta ?? "",
        direction,
        activeFilter,
      )
      if (next) onCuentaChange?.(next)
    },
    [accounts, activeFilter, cuenta, onCuentaChange, summary?.cuenta],
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F7" && event.key !== "F8") return
      event.preventDefault()
      event.stopImmediatePropagation()
      goToAccount(event.key === "F7" ? "prev" : "next")
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [goToAccount, open])

  const visibleMovements = useMemo(() => {
    if (!summary) return []
    if (!punteoMode) return summary.movements
    return summary.movements.filter((row) => lineVisibleInPunteo(row, punteoWindow, filter))
  }, [filter, punteoMode, punteoWindow, summary])

  const balances = useMemo(() => {
    if (!summary) return null
    return buildPunteoBalances(
      summary.movements,
      { contable: summary.openingBalance, punteado: summary.openingPunteado ?? 0 },
      punteoWindow,
    )
  }, [punteoWindow, summary])

  const navTarget = (direction: PunteoMove) =>
    movePunteoAccount(accounts, summary?.cuenta ?? cuenta ?? "", direction, activeFilter)

  const eligibleCount = accounts.filter((account) => {
    if (activeFilter === "no-punteados") return account.untickedCount > 0
    if (activeFilter === "punteados") return account.tickedCount > 0
    return account.tickedCount + account.untickedCount > 0
  }).length

  const handleDeleteEntry = async (entryId: string) => {
    const confirmed = window.confirm(
      "¿Eliminar este asiento de forma permanente? Esta acción no se puede deshacer.",
    )
    if (!confirmed) return

    setDeletingEntryId(entryId)
    setActionError(null)

    try {
      await apiFetch(`/api/accounting/entries/${entryId}`, { method: "DELETE" })
      onEntryDeleted?.()
      onChanged?.()
      setAccountRefresh((value) => value + 1)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo eliminar el asiento.")
    } finally {
      setDeletingEntryId(null)
    }
  }

  const markLines = async (ids: string[], punteado: boolean) => {
    const changing = summary?.movements.filter((row) => ids.includes(row.id) && row.punteado !== punteado) ?? []
    if (changing.length === 0) return
    const changingIds = changing.map((row) => row.id)
    const code = normalizeCuenta(summary?.cuenta ?? cuenta ?? "")

    setPendingIds(changingIds)
    setActionError(null)
    setSummary((current) => {
      if (!current) return current
      return {
        ...current,
        movements: current.movements.map((row) =>
          changingIds.includes(row.id) ? { ...row, punteado } : row,
        ),
      }
    })
    setAccounts((current) =>
      current.map((account) => {
        if (normalizeCuenta(account.cuenta) !== code) return account
        return {
          ...account,
          tickedCount: Math.max(0, account.tickedCount + (punteado ? changingIds.length : -changingIds.length)),
          untickedCount: Math.max(0, account.untickedCount + (punteado ? -changingIds.length : changingIds.length)),
        }
      }),
    )

    try {
      await apiFetch("/api/accounting/punteo", {
        method: "POST",
        body: JSON.stringify({ lineIds: changingIds, punteado }),
      })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo guardar el punteo.")
      setLocalRefresh((value) => value + 1)
      setAccountRefresh((value) => value + 1)
    } finally {
      setPendingIds([])
    }
  }

  const heading = currentAccount
    ? `${currentAccount.formattedCuenta} · ${currentAccount.label}`
    : summary
      ? `${summary.formattedCuenta} · ${summary.label}`
      : "Elige una cuenta"

  const nextLabel =
    activeFilter === "no-punteados"
      ? "Siguiente cuenta con apuntes sin puntear (F8)"
      : "Cuenta siguiente (F8)"
  const prevLabel =
    activeFilter === "no-punteados"
      ? "Cuenta anterior con apuntes sin puntear (F7)"
      : "Cuenta anterior (F7)"

  return (
    <>
      <AccountingModal
        open={open}
        title={punteoMode ? "Punteo de extractos" : "Extracto de cuenta"}
        subtitle={
          punteoMode
            ? `Ejercicio ${year} · F7 cuenta anterior · F8 cuenta siguiente`
            : cuenta
              ? `EX · Movimientos del ejercicio ${year}`
              : undefined
        }
        onClose={onClose}
        onBack={onBack}
        backLabel="Volver al extracto de cuentas"
        className="max-w-6xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              title="Primera cuenta"
              aria-label="Primera cuenta"
              disabled={!navTarget("first") || isLoadingAccounts}
              onClick={() => goToAccount("first")}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              title={prevLabel}
              aria-label={prevLabel}
              disabled={!navTarget("prev") || isLoadingAccounts}
              onClick={() => goToAccount("prev")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              title={nextLabel}
              aria-label={nextLabel}
              disabled={!navTarget("next") || isLoadingAccounts}
              onClick={() => goToAccount("next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              title="Última cuenta"
              aria-label="Última cuenta"
              disabled={!navTarget("last") || isLoadingAccounts}
              onClick={() => goToAccount("last")}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-pine-900">{heading}</p>
            <span className="text-xs text-graphite-500">
              {eligibleCount === 1 ? "1 cuenta" : `${eligibleCount} cuentas`}
            </span>
            <Button
              type="button"
              variant={punteoMode ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => setPunteoMode((value) => !value)}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              {punteoMode ? "Cerrar punteo" : "Puntear"}
            </Button>
          </div>

          {punteoMode ? (
            <div className="space-y-3 rounded-lg border border-sand-200 bg-sand-50 px-3 py-3">
              <fieldset className="flex flex-wrap gap-4 text-sm text-graphite-800">
                <legend className="sr-only">Apuntes a mostrar</legend>
                {FILTERS.map((option) => (
                  <label key={option.id} className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="punteo-filter"
                      checked={filter === option.id}
                      onChange={() => setFilter(option.id)}
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1 text-xs text-graphite-600">
                  Desde la fecha
                  <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-9" />
                </label>
                <label className="space-y-1 text-xs text-graphite-600">
                  Hasta la fecha
                  <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-9" />
                </label>
                <label className="space-y-1 text-xs text-graphite-600">
                  Desde el importe
                  <Input
                    inputMode="decimal"
                    value={fromAmount}
                    placeholder="0,00"
                    onChange={(event) => setFromAmount(event.target.value)}
                    className="h-9"
                  />
                </label>
                <label className="space-y-1 text-xs text-graphite-600">
                  Hasta el importe
                  <Input
                    inputMode="decimal"
                    value={toAmount}
                    placeholder="0,00"
                    onChange={(event) => setToAmount(event.target.value)}
                    className="h-9"
                  />
                </label>
              </div>
              <p className="text-xs text-graphite-600">
                El visto marca el apunte como casado. Con «No punteados» pasas de cuenta en cuenta y ves lo que falta.
              </p>
              {balances ? (
                <div className="overflow-auto rounded-md border border-sand-200 bg-white">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-sand-100 text-left text-xs uppercase tracking-wide text-graphite-600">
                      <tr>
                        <th className="px-3 py-2">Saldos</th>
                        <th className="px-3 py-2 text-right">Saldo inicial</th>
                        <th className="px-3 py-2 text-right">Acum. debe</th>
                        <th className="px-3 py-2 text-right">Acum. haber</th>
                        <th className="px-3 py-2 text-right">Saldo final</th>
                      </tr>
                    </thead>
                    <tbody>
                      <BalanceRow label="Contable" row={balances.contable} />
                      <BalanceRow label="Punteado" row={balances.punteado} />
                    </tbody>
                  </table>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={visibleMovements.every((row) => row.punteado) || pendingIds.length > 0}
                  onClick={() => void markLines(visibleMovements.map((row) => row.id), true)}
                >
                  Puntear los visibles
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={visibleMovements.every((row) => !row.punteado) || pendingIds.length > 0}
                  onClick={() => void markLines(visibleMovements.map((row) => row.id), false)}
                >
                  Quitar el visto
                </Button>
              </div>
            </div>
          ) : null}

          {actionError || accountsError ? (
            <p className="text-sm text-red-700" role="alert">
              {actionError || accountsError}
            </p>
          ) : null}

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-emerald-800">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Cargando movimientos…
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : !cuenta && isLoadingAccounts ? (
            <div className="flex items-center justify-center py-16 text-emerald-800">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Buscando cuentas con apuntes…
            </div>
          ) : !cuenta && accounts.length === 0 && !accountsError ? (
            <p className="py-8 text-center text-sm text-graphite-500">
              Este ejercicio no tiene apuntes para puntear.
            </p>
          ) : summary ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                <div className="flex flex-wrap gap-4">
                  <span>Debe: {formatEuro(summary.totalDebe)}</span>
                  <span>Haber: {formatEuro(summary.totalHaber)}</span>
                  <span>
                    Saldo: <strong>{formatEuro(summary.closingBalance)}</strong>
                  </span>
                  {punteoMode && currentAccount ? (
                    <span>Sin puntear: {currentAccount.untickedCount}</span>
                  ) : null}
                </div>
                {cuenta ? (
                  <div className="flex flex-wrap gap-2">
                    {onEditAccount ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 border-emerald-300 bg-white text-emerald-900"
                        onClick={() => onEditAccount(cuenta, summary.label)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Editar cuenta
                      </Button>
                    ) : null}
                    {onReleaseAccount ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 border-red-200 bg-white text-red-700 hover:bg-red-50"
                        onClick={() => onReleaseAccount(cuenta, summary.label)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Eliminar cuenta
                      </Button>
                    ) : null}
                    {summary.movements.length > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 border-emerald-300 bg-white text-emerald-900"
                        onClick={() => setTransferOpen(true)}
                      >
                        <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
                        Editar movimientos
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="max-h-[420px] overflow-auto rounded-lg border border-sand-200">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="sticky top-0 bg-sand-100 text-left text-xs uppercase tracking-wide text-graphite-600">
                    <tr>
                      {punteoMode ? <th className="w-12 px-2 py-2">P</th> : null}
                      <th className="px-3 py-2">Ref.</th>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Concepto</th>
                      <th className="px-3 py-2">Documento</th>
                      <th className="px-3 py-2">Contrapartida</th>
                      <th className="px-3 py-2 text-right">Debe</th>
                      <th className="px-3 py-2 text-right">Haber</th>
                      <th className="px-3 py-2 text-right">Saldo</th>
                      <th className="w-10 px-1 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMovements.length === 0 ? (
                      <tr>
                        <td colSpan={punteoMode ? 10 : 9} className="px-3 py-8 text-center text-graphite-500">
                          {punteoMode && filter === "no-punteados"
                            ? "Esta cuenta no tiene apuntes sin puntear."
                            : punteoMode && filter === "punteados"
                              ? "Esta cuenta no tiene apuntes punteados."
                              : `No hay movimientos para esta cuenta en ${year}.`}
                        </td>
                      </tr>
                    ) : (
                      visibleMovements.map((row) => (
                        <tr
                          key={row.id}
                          className={`cursor-pointer border-t border-sand-100 hover:bg-emerald-50/70 ${
                            row.punteado ? "bg-emerald-50/80" : ""
                          }`}
                          onClick={() => onOpenEntry?.(row.entryId)}
                          onDoubleClick={() => onOpenEntry?.(row.entryId)}
                          title="Clic para modificar el asiento"
                        >
                          {punteoMode ? (
                            <td className="px-2 py-2">
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={row.punteado}
                                aria-label={row.punteado ? "Quitar punteo" : "Puntear apunte"}
                                title={row.punteado ? "Quitar punteo" : "Puntear apunte"}
                                disabled={pendingIds.includes(row.id)}
                                className={`flex h-5 w-5 items-center justify-center rounded border ${
                                  row.punteado
                                    ? "border-emerald-700 bg-emerald-700 text-white"
                                    : "border-graphite-300 bg-white text-transparent"
                                }`}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void markLines([row.id], !row.punteado)
                                }}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          ) : null}
                          <td className="px-3 py-2 font-mono text-xs font-semibold">{row.refNumber}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.fecha}</td>
                          <td className="px-3 py-2">{row.concepto || "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.documento || "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.contrapartida ?? "—"}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {row.debe ? formatEuro(row.debe) : ""}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {row.haber ? formatEuro(row.haber) : ""}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {formatEuro(row.saldo)}
                          </td>
                          <td className="px-1 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                              disabled={deletingEntryId === row.entryId}
                              title="Eliminar asiento"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleDeleteEntry(row.entryId)
                              }}
                            >
                              {deletingEntryId === row.entryId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-graphite-500">
                F7 cuenta anterior · F8 cuenta siguiente · clic en la fila para modificar el asiento
              </p>
            </div>
          ) : null}
        </div>
      </AccountingModal>
      {summary && cuenta ? (
        <TransferMovementsDialog
          open={transferOpen}
          fromAccountCode={cuenta}
          fromAccountLabel={summary.label}
          movements={summary.movements}
          onClose={() => setTransferOpen(false)}
          onTransferred={() => {
            setLocalRefresh((value) => value + 1)
            setAccountRefresh((value) => value + 1)
            onChanged?.()
            onEntryDeleted?.()
          }}
        />
      ) : null}
    </>
  )
}

function BalanceRow({
  label,
  row,
}: {
  label: string
  row: { saldoInicial: number; acumDebe: number; acumHaber: number; saldoFinal: number }
}) {
  return (
    <tr className="border-t border-sand-100">
      <td className="px-3 py-2 font-medium">{label}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatEuro(row.saldoInicial)}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatEuro(row.acumDebe)}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatEuro(row.acumHaber)}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatEuro(row.saldoFinal)}</td>
    </tr>
  )
}

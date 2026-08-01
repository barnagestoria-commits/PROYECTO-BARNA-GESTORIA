"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react"
import { useRequireAuth } from "@/components/auth-provider"
import {
  BANK_MOVEMENT_STATUS_LABELS,
  BankMovementStatusIcon,
} from "@/components/bank-reconciliation/bank-movement-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiFetch, apiFormFetch } from "@/lib/api-client"
import type {
  BankImportPreview,
  BankMovementView,
  BankReconciliationSummary,
  ReconciliationCandidate,
} from "@/lib/bank-reconciliation/types"
import { cn } from "@/lib/utils"

function formatEuro(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES")
}

export function BankReconciliationWorkspace() {
  const { session, activeCompany } = useRequireAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [summary, setSummary] = useState<BankReconciliationSummary | null>(null)
  const [movements, setMovements] = useState<BankMovementView[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<ReconciliationCandidate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isAutoMatching, setIsAutoMatching] = useState(false)
  const [pendingPreview, setPendingPreview] = useState<BankImportPreview | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyMovementId, setBusyMovementId] = useState<string | null>(null)

  const companyId = session?.activeCompanyId ?? ""
  const selectedMovement = useMemo(
    () => movements.find((movement) => movement.id === selectedId) ?? null,
    [movements, selectedId],
  )

  const loadCandidates = useCallback(
    async (movementId: string) => {
      if (!companyId) return
      const data = await apiFetch<{ success: true; candidates: ReconciliationCandidate[] }>(
        `/api/bank-reconciliation/candidates?companyId=${encodeURIComponent(companyId)}&movementId=${movementId}`,
      )
      setCandidates(data.candidates)
    },
    [companyId],
  )

  const loadData = useCallback(async () => {
    if (!companyId) return

    setIsLoading(true)
    try {
      const [summaryRes, movementsRes] = await Promise.all([
        apiFetch<{ success: true; summary: BankReconciliationSummary }>(
          `/api/bank-reconciliation/summary?companyId=${encodeURIComponent(companyId)}`,
        ),
        apiFetch<{ success: true; movements: BankMovementView[] }>(
          `/api/bank-reconciliation/movements?companyId=${encodeURIComponent(companyId)}`,
        ),
      ])

      setSummary(summaryRes.summary)
      setMovements(movementsRes.movements)
      setSelectedId((prev) => {
        if (prev && movementsRes.movements.some((movement) => movement.id === prev)) return prev
        return movementsRes.movements[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la conciliación.")
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!selectedId) return
    const selected = movements.find((movement) => movement.id === selectedId)
    if (!selected) return
    if (selected.status === "PENDIENTE") {
      void loadCandidates(selectedId).catch(() => setCandidates([]))
    } else {
      setCandidates([])
    }
  }, [loadCandidates, movements, selectedId])

  const handleSelectMovement = async (movement: BankMovementView) => {
    setSelectedId(movement.id)
    if (movement.status === "PENDIENTE") {
      try {
        await loadCandidates(movement.id)
      } catch {
        setCandidates([])
      }
    } else {
      setCandidates([])
    }
  }

  const handleFileSelect = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file || !companyId || isPreviewing) return

    setIsPreviewing(true)
    setError(null)
    setMessage(null)
    setPendingPreview(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("companyId", companyId)

      const data = await apiFormFetch<{
        success: true
        preview: BankImportPreview & { movementCount: number }
      }>("/api/bank-reconciliation/preview", formData)

      setPendingPreview({
        fileName: data.preview.fileName,
        source: data.preview.source,
        movements: data.preview.movements,
        warnings: data.preview.warnings,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al leer el extracto.")
    } finally {
      setIsPreviewing(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleConfirmImport = async () => {
    if (!pendingPreview || !companyId || isImporting) return
    setIsImporting(true)
    setError(null)

    try {
      const data = await apiFetch<{
        success: true
        result: { imported: number; duplicatesSkipped: number }
      }>("/api/bank-reconciliation/import", {
        method: "POST",
        body: JSON.stringify({ companyId, preview: pendingPreview }),
      })

      setMessage(
        `Importados ${data.result.imported} movimientos` +
          (data.result.duplicatesSkipped > 0
            ? ` (${data.result.duplicatesSkipped} duplicados omitidos).`
            : "."),
      )
      setPendingPreview(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar movimientos.")
    } finally {
      setIsImporting(false)
    }
  }

  const handleAutoMatch = async () => {
    if (!companyId || isAutoMatching) return
    setIsAutoMatching(true)
    setError(null)
    try {
      const targetId =
        selectedId && selectedMovement?.status === "PENDIENTE" ? selectedId : undefined
      const data = await apiFetch<{ success: true; result: { matched: number } }>(
        "/api/bank-reconciliation/auto-match",
        {
          method: "POST",
          body: JSON.stringify({ companyId, ...(targetId ? { movementId: targetId } : {}) }),
        },
      )
      if (targetId) {
        setMessage(
          data.result.matched > 0
            ? "Movimiento interpretado automáticamente."
            : "Sin coincidencia automática para este movimiento. Revisa las propuestas.",
        )
      } else {
        setMessage(`Interpretados automáticamente: ${data.result.matched} movimientos.`)
      }
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en conciliación automática.")
    } finally {
      setIsAutoMatching(false)
    }
  }

  const handleMatch = async (movementId: string, entryLineId: string) => {
    if (!companyId) return
    setBusyMovementId(movementId)
    try {
      await apiFetch("/api/bank-reconciliation/match", {
        method: "POST",
        body: JSON.stringify({ companyId, movementId, entryLineId }),
      })
      setMessage("Movimiento interpretado (vinculado al asiento).")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conciliar.")
    } finally {
      setBusyMovementId(null)
    }
  }

  const handleReview = async (movementId: string) => {
    if (!companyId) return
    setBusyMovementId(movementId)
    setError(null)
    try {
      await apiFetch("/api/bank-reconciliation/review", {
        method: "POST",
        body: JSON.stringify({ companyId, movementId }),
      })
      setMessage("Movimiento marcado como revisado.")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo marcar como revisado.")
    } finally {
      setBusyMovementId(null)
    }
  }

  const handleUnmatch = async (movementId: string) => {
    if (!companyId) return
    setBusyMovementId(movementId)
    setError(null)
    try {
      await apiFetch("/api/bank-reconciliation/unmatch", {
        method: "POST",
        body: JSON.stringify({ companyId, movementId }),
      })
      setMessage("Movimiento desvinculado. Vuelve a estado pendiente.")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desvincular el movimiento.")
    } finally {
      setBusyMovementId(null)
    }
  }

  const handleIgnore = async (movementId: string) => {
    if (!companyId) return
    setBusyMovementId(movementId)
    setError(null)
    try {
      await apiFetch("/api/bank-reconciliation/ignore", {
        method: "POST",
        body: JSON.stringify({ companyId, movementId }),
      })
      setMessage("Movimiento marcado como no contabilizable.")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo marcar como no contabilizable.")
    } finally {
      setBusyMovementId(null)
    }
  }

  const handleResetPending = async (movementId: string) => {
    if (!companyId) return
    setBusyMovementId(movementId)
    setError(null)
    try {
      await apiFetch("/api/bank-reconciliation/reset-pending", {
        method: "POST",
        body: JSON.stringify({ companyId, movementId }),
      })
      setMessage("Movimiento restaurado a pendiente.")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo restaurar el movimiento.")
    } finally {
      setBusyMovementId(null)
    }
  }

  const handleDelete = async (movementId: string) => {
    if (!companyId) return
    if (!window.confirm("¿Eliminar este movimiento del extracto importado?")) return

    setBusyMovementId(movementId)
    setError(null)
    try {
      await apiFetch("/api/bank-reconciliation/delete", {
        method: "POST",
        body: JSON.stringify({ companyId, movementId }),
      })
      setMessage("Movimiento eliminado.")
      setSelectedId(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el movimiento.")
    } finally {
      setBusyMovementId(null)
    }
  }

  if (!session) return null

  return (
    <div className="space-y-4">
      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sand-200 bg-sand-50/80 px-3 py-2">
        <Button
          type="button"
          size="sm"
          className="bg-emerald-800 hover:bg-pine-900"
          disabled={isPreviewing}
          onClick={() => fileInputRef.current?.click()}
        >
          {isPreviewing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
          Importar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isAutoMatching || movements.length === 0}
          onClick={() => void handleAutoMatch()}
        >
          {isAutoMatching ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
          {selectedMovement?.status === "PENDIENTE" ? "Analizar seleccionado" : "Analizar todos"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={isLoading} onClick={() => void loadData()}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Actualizar
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.xlsx,.xls,.pdf"
          className="hidden"
          onChange={(event) => void handleFileSelect(event.target.files)}
        />
      </div>

      {pendingPreview && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium">
              Vista previa: {pendingPreview.movements.length} movimientos ({pendingPreview.source})
            </p>
            <div className="flex gap-2">
              <Button size="sm" disabled={isImporting} onClick={() => void handleConfirmImport()}>
                {isImporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                Confirmar importación
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPendingPreview(null)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-sand-200 bg-white px-4 py-3 text-xs text-graphite-700">
        <p className="font-semibold text-pine-900">{activeCompany?.name}</p>
        <p className="mt-1">
          {summary?.totalCount ?? 0} movimientos · {summary?.reviewedCount ?? 0} revisados ·{" "}
          {summary?.pendingCount ?? 0} pendientes
        </p>
        {summary && (summary.openingBalance !== null || summary.closingBalance !== null) && (
          <p className="mt-1">
            Saldo inicial: {summary.openingBalance !== null ? formatEuro(summary.openingBalance) : "—"} · Saldo final:{" "}
            {summary.closingBalance !== null ? formatEuro(summary.closingBalance) : "—"}
          </p>
        )}
      </div>

      <Card className="overflow-hidden border-sand-300">
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-sand-100 text-graphite-700">
              <tr>
                <th className="w-10 border-b border-sand-200 px-2 py-2 text-left">Est.</th>
                <th className="border-b border-sand-200 px-2 py-2 text-left">Fecha</th>
                <th className="border-b border-sand-200 px-2 py-2 text-left">Descripción</th>
                <th className="border-b border-sand-200 px-2 py-2 text-left">Contrapartida</th>
                <th className="border-b border-sand-200 px-2 py-2 text-left">Concepto (Asiento)</th>
                <th className="border-b border-sand-200 px-2 py-2 text-right">Importe</th>
                <th className="border-b border-sand-200 px-2 py-2 text-right">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" />
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-graphite-500">
                    Importa un extracto bancario para ver los movimientos aquí.
                  </td>
                </tr>
              ) : (
                movements.map((movement) => {
                  const isSelected = movement.id === selectedId
                  return (
                    <tr
                      key={movement.id}
                      className={cn(
                        "cursor-pointer border-b border-sand-100 hover:bg-emerald-50/40",
                        isSelected && "bg-emerald-100/60",
                      )}
                      onClick={() => void handleSelectMovement(movement)}
                    >
                      <td className="px-2 py-1.5">
                        <BankMovementStatusIcon status={movement.status} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5">{formatDate(movement.movementDate)}</td>
                      <td className="max-w-[240px] truncate px-2 py-1.5" title={movement.concept}>
                        {movement.concept}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11px]">
                        {movement.matchedCounterpartyCode ?? "—"}
                      </td>
                      <td className="max-w-[180px] truncate px-2 py-1.5" title={movement.matchedConcept ?? undefined}>
                        {movement.matchedConcept ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-2 py-1.5 text-right font-medium",
                          movement.amount >= 0 ? "text-emerald-800" : "text-red-700",
                        )}
                      >
                        {formatEuro(movement.amount)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right">
                        {movement.accumulated !== null ? formatEuro(movement.accumulated) : "—"}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedMovement && (
        <Card className="border-sand-300">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-pine-900">Movimiento seleccionado</p>
                <p className="text-xs text-graphite-600">{selectedMovement.concept}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <BankMovementStatusIcon status={selectedMovement.status} />
                <span>{BANK_MOVEMENT_STATUS_LABELS[selectedMovement.status].label}</span>
              </div>
            </div>

            <div className="grid gap-3 text-xs sm:grid-cols-4">
              <div>
                <p className="text-graphite-500">F. Valor</p>
                <p>{selectedMovement.valueDate ? formatDate(selectedMovement.valueDate) : formatDate(selectedMovement.movementDate)}</p>
              </div>
              <div>
                <p className="text-graphite-500">Importe</p>
                <p className={selectedMovement.amount >= 0 ? "text-emerald-800" : "text-red-700"}>
                  {formatEuro(selectedMovement.amount)}
                </p>
              </div>
              <div>
                <p className="text-graphite-500">Saldo</p>
                <p>{selectedMovement.accumulated !== null ? formatEuro(selectedMovement.accumulated) : "—"}</p>
              </div>
              <div>
                <p className="text-graphite-500">Asiento</p>
                <p>{selectedMovement.matchedEntryRef ? `Nº ${selectedMovement.matchedEntryRef}` : "—"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedMovement.status === "PENDIENTE" && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyMovementId === selectedMovement.id || isAutoMatching}
                    onClick={() => void handleAutoMatch()}
                  >
                    {isAutoMatching ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-1 h-4 w-4" />
                    )}
                    Interpretar (auto)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyMovementId === selectedMovement.id}
                    onClick={() => void handleIgnore(selectedMovement.id)}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    No contabilizable
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyMovementId === selectedMovement.id}
                    onClick={() => void handleDelete(selectedMovement.id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Eliminar
                  </Button>
                </>
              )}
              {selectedMovement.status === "CONCILIADO" && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyMovementId === selectedMovement.id}
                    onClick={() => void handleReview(selectedMovement.id)}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Marcar revisado
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyMovementId === selectedMovement.id}
                    onClick={() => void handleUnmatch(selectedMovement.id)}
                  >
                    Desvincular
                  </Button>
                </>
              )}
              {selectedMovement.status === "REVISADO" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyMovementId === selectedMovement.id}
                  onClick={() => void handleUnmatch(selectedMovement.id)}
                >
                  Desvincular
                </Button>
              )}
              {selectedMovement.status === "IGNORADO" && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyMovementId === selectedMovement.id}
                    onClick={() => void handleResetPending(selectedMovement.id)}
                  >
                    Restaurar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyMovementId === selectedMovement.id}
                    onClick={() => void handleDelete(selectedMovement.id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Eliminar
                  </Button>
                </>
              )}
            </div>

            <Tabs defaultValue="propuestas">
              <TabsList>
                <TabsTrigger value="asiento">Asiento a contabilizar</TabsTrigger>
                <TabsTrigger value="datos">Ampliación datos extracto</TabsTrigger>
                <TabsTrigger value="propuestas">Propuestas</TabsTrigger>
              </TabsList>
              <TabsContent value="asiento" className="mt-3 text-xs text-graphite-700">
                {selectedMovement.status === "PENDIENTE" ? (
                  <p>Vincula este movimiento con una línea 572/570 del diario usando las propuestas o el botón Analizar.</p>
                ) : (
                  <p>
                    Cuenta {selectedMovement.matchedAccountCode ?? "—"} · Contrapartida{" "}
                    {selectedMovement.matchedCounterpartyCode ?? "—"} · Asiento nº{" "}
                    {selectedMovement.matchedEntryRef ?? "—"}
                  </p>
                )}
              </TabsContent>
              <TabsContent value="datos" className="mt-3 text-xs text-graphite-700">
                <p>Referencia: {selectedMovement.reference ?? "—"}</p>
                <p className="mt-1">Origen: {selectedMovement.importFileName ?? "—"}</p>
              </TabsContent>
              <TabsContent value="propuestas" className="mt-3 space-y-2">
                {selectedMovement.status !== "PENDIENTE" ? (
                  <p className="text-xs text-graphite-600">Este movimiento ya está interpretado o cerrado.</p>
                ) : candidates.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    Sin propuestas. Comprueba que exista un asiento en 572/570 con el mismo importe y fecha cercana.
                  </p>
                ) : (
                  candidates.map((candidate) => (
                    <button
                      key={candidate.entryLineId}
                      type="button"
                      disabled={busyMovementId === selectedMovement.id}
                      onClick={() => void handleMatch(selectedMovement.id, candidate.entryLineId)}
                      className="flex w-full items-center justify-between rounded border border-sand-200 px-3 py-2 text-left text-xs hover:border-emerald-300 hover:bg-emerald-50/50"
                    >
                      <span>
                        Asiento {candidate.entryRef} · {formatDate(candidate.entryDate)} · {candidate.cuenta} ·{" "}
                        {candidate.concepto || "Sin concepto"}
                      </span>
                      <span className="text-graphite-500">{candidate.reason}</span>
                    </button>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-sand-200 bg-sand-50/60 px-4 py-3 text-[11px] text-graphite-600">
        <p className="mb-2 font-medium text-graphite-700">Leyenda de estados (estilo A3Bank)</p>
        <div className="flex flex-wrap gap-4">
          {(Object.keys(BANK_MOVEMENT_STATUS_LABELS) as BankMovementView["status"][]).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <BankMovementStatusIcon status={status} />
              {BANK_MOVEMENT_STATUS_LABELS[status].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

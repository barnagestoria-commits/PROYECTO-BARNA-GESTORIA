"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react"
import { useRequireAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  const [activeTab, setActiveTab] = useState<"PENDIENTE" | "CONCILIADO" | "IGNORADO">("PENDIENTE")
  const [candidatesByMovement, setCandidatesByMovement] = useState<
    Record<string, ReconciliationCandidate[]>
  >({})
  const [isLoading, setIsLoading] = useState(true)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isAutoMatching, setIsAutoMatching] = useState(false)
  const [pendingPreview, setPendingPreview] = useState<BankImportPreview | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyMovementId, setBusyMovementId] = useState<string | null>(null)

  const companyId = session?.activeCompanyId ?? ""

  const loadData = useCallback(async () => {
    if (!companyId) return

    setIsLoading(true)
    try {
      const [summaryRes, movementsRes] = await Promise.all([
        apiFetch<{ success: true; summary: BankReconciliationSummary }>(
          `/api/bank-reconciliation/summary?companyId=${encodeURIComponent(companyId)}`,
        ),
        apiFetch<{ success: true; movements: BankMovementView[] }>(
          `/api/bank-reconciliation/movements?companyId=${encodeURIComponent(companyId)}&status=${activeTab}`,
        ),
      ])

      setSummary(summaryRes.summary)
      setMovements(movementsRes.movements)

      if (activeTab === "PENDIENTE") {
        const candidateEntries = await Promise.all(
          movementsRes.movements.slice(0, 30).map(async (movement) => {
            const data = await apiFetch<{ success: true; candidates: ReconciliationCandidate[] }>(
              `/api/bank-reconciliation/candidates?companyId=${encodeURIComponent(companyId)}&movementId=${movement.id}`,
            )
            return [movement.id, data.candidates] as const
          }),
        )
        setCandidatesByMovement(Object.fromEntries(candidateEntries))
      } else {
        setCandidatesByMovement({})
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la conciliación.")
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, companyId])

  useEffect(() => {
    void loadData()
  }, [loadData])

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
        preview: BankImportPreview & { movementCount: number; sample: BankImportPreview["movements"] }
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
        body: JSON.stringify({
          companyId,
          preview: pendingPreview,
        }),
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
      const data = await apiFetch<{ success: true; result: { matched: number } }>(
        "/api/bank-reconciliation/auto-match",
        {
          method: "POST",
          body: JSON.stringify({ companyId }),
        },
      )
      setMessage(`Conciliación automática: ${data.result.matched} movimientos vinculados.`)
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
    setError(null)

    try {
      await apiFetch("/api/bank-reconciliation/match", {
        method: "POST",
        body: JSON.stringify({ companyId, movementId, entryLineId }),
      })
      setMessage("Movimiento conciliado correctamente.")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conciliar.")
    } finally {
      setBusyMovementId(null)
    }
  }

  const handleUnmatch = async (movementId: string) => {
    if (!companyId) return
    setBusyMovementId(movementId)
    try {
      await apiFetch("/api/bank-reconciliation/unmatch", {
        method: "POST",
        body: JSON.stringify({ companyId, movementId }),
      })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo deshacer la conciliación.")
    } finally {
      setBusyMovementId(null)
    }
  }

  const handleIgnore = async (movementId: string) => {
    if (!companyId) return
    setBusyMovementId(movementId)
    try {
      await apiFetch("/api/bank-reconciliation/ignore", {
        method: "POST",
        body: JSON.stringify({ companyId, movementId }),
      })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ignorar el movimiento.")
    } finally {
      setBusyMovementId(null)
    }
  }

  if (!session) return null

  return (
    <div className="space-y-6">
      {message && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pendientes</CardDescription>
            <CardTitle className="text-2xl">{summary?.pendingCount ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conciliados</CardDescription>
            <CardTitle className="text-2xl">{summary?.reconciledCount ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ignorados</CardDescription>
            <CardTitle className="text-2xl">{summary?.ignoredCount ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Saldo pendiente</CardDescription>
            <CardTitle className="text-xl">{summary ? formatEuro(summary.pendingAmount) : "—"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle className="text-lg text-pine-900">Importar extracto bancario</CardTitle>
          <CardDescription>
            CSV, Excel (.xlsx) o PDF (OCR con DeepSeek). Empresa activa: {activeCompany?.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.xlsx,.xls,.pdf"
            className="hidden"
            onChange={(event) => void handleFileSelect(event.target.files)}
          />

          {!pendingPreview && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-emerald-800 hover:bg-pine-900"
                disabled={isPreviewing}
                onClick={() => fileInputRef.current?.click()}
              >
                {isPreviewing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Seleccionar extracto
              </Button>
              <Button type="button" variant="outline" disabled={isLoading} onClick={() => void loadData()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>
            </div>
          )}

          {pendingPreview && (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="text-sm font-medium text-pine-900">
                {pendingPreview.movements.length} movimientos detectados en {pendingPreview.fileName} (
                {pendingPreview.source})
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-graphite-600">
                      <th className="px-2 py-1">Fecha</th>
                      <th className="px-2 py-1">Concepto</th>
                      <th className="px-2 py-1 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPreview.movements.slice(0, 8).map((movement, index) => (
                      <tr key={`${movement.movementDate}-${index}`} className="border-t border-emerald-100">
                        <td className="px-2 py-1">{formatDate(movement.movementDate)}</td>
                        <td className="px-2 py-1">{movement.concept}</td>
                        <td
                          className={cn(
                            "px-2 py-1 text-right font-medium",
                            movement.amount >= 0 ? "text-emerald-800" : "text-red-700",
                          )}
                        >
                          {formatEuro(movement.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pendingPreview.warnings.slice(0, 3).map((warning) => (
                <p key={warning} className="text-xs text-amber-800">
                  {warning}
                </p>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="bg-emerald-800 hover:bg-pine-900"
                  disabled={isImporting}
                  onClick={() => void handleConfirmImport()}
                >
                  {isImporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Confirmar importación
                </Button>
                <Button type="button" variant="outline" disabled={isImporting} onClick={() => setPendingPreview(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <p className="text-xs text-graphite-500">
            Columnas admitidas: fecha + importe, o fecha + cargo/abono (debe/haber). La conciliación busca líneas de
            cuentas 572/570 en el diario.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Movimientos bancarios</CardTitle>
            <CardDescription>Concilia con asientos contables de tesorería (572/570)</CardDescription>
          </div>
          {activeTab === "PENDIENTE" && (
            <Button
              type="button"
              variant="outline"
              disabled={isAutoMatching || isLoading}
              onClick={() => void handleAutoMatch()}
            >
              {isAutoMatching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Conciliar automáticamente
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as typeof activeTab)}
          >
            <TabsList>
              <TabsTrigger value="PENDIENTE">Pendientes</TabsTrigger>
              <TabsTrigger value="CONCILIADO">Conciliados</TabsTrigger>
              <TabsTrigger value="IGNORADO">Ignorados</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
                </div>
              ) : movements.length === 0 ? (
                <p className="py-10 text-center text-sm text-graphite-500">
                  No hay movimientos en este estado. Importa un extracto para empezar.
                </p>
              ) : (
                <div className="space-y-3">
                  {movements.map((movement) => {
                    const candidates = candidatesByMovement[movement.id] ?? []
                    const isBusy = busyMovementId === movement.id

                    return (
                      <div
                        key={movement.id}
                        className="rounded-xl border border-sand-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-pine-900">{formatDate(movement.movementDate)}</p>
                              <Badge variant={movement.status === "CONCILIADO" ? "default" : "secondary"}>
                                {movement.status === "PENDIENTE"
                                  ? "Pendiente"
                                  : movement.status === "CONCILIADO"
                                    ? "Conciliado"
                                    : "Ignorado"}
                              </Badge>
                              {movement.matchedEntryRef && (
                                <span className="text-xs text-emerald-700">
                                  Asiento nº {movement.matchedEntryRef}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-graphite-700">{movement.concept}</p>
                            {movement.reference && (
                              <p className="text-xs text-graphite-500">Ref: {movement.reference}</p>
                            )}
                            {movement.importFileName && (
                              <p className="text-xs text-graphite-400">{movement.importFileName}</p>
                            )}
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <p
                              className={cn(
                                "text-lg font-semibold",
                                movement.amount >= 0 ? "text-emerald-800" : "text-red-700",
                              )}
                            >
                              {formatEuro(movement.amount)}
                            </p>

                            {movement.status === "PENDIENTE" && (
                              <div className="flex flex-wrap justify-end gap-2">
                                {candidates[0] && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={isBusy}
                                    onClick={() => void handleMatch(movement.id, candidates[0]!.entryLineId)}
                                  >
                                    {isBusy ? (
                                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="mr-1 h-3 w-3" />
                                    )}
                                    Conciliar asiento {candidates[0].entryRef}
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isBusy}
                                  onClick={() => void handleIgnore(movement.id)}
                                >
                                  Ignorar
                                </Button>
                              </div>
                            )}

                            {movement.status === "CONCILIADO" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => void handleUnmatch(movement.id)}
                              >
                                <XCircle className="mr-1 h-3 w-3" />
                                Deshacer
                              </Button>
                            )}
                          </div>
                        </div>

                        {movement.status === "PENDIENTE" && candidates.length > 0 && (
                          <div className="mt-3 border-t border-sand-100 pt-3">
                            <p className="mb-2 text-xs font-medium text-graphite-600">Coincidencias sugeridas</p>
                            <div className="space-y-2">
                              {candidates.map((candidate) => (
                                <button
                                  key={candidate.entryLineId}
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleMatch(movement.id, candidate.entryLineId)}
                                  className="flex w-full items-center justify-between rounded-lg border border-sand-200 px-3 py-2 text-left text-xs hover:border-emerald-300 hover:bg-emerald-50/50"
                                >
                                  <span>
                                    Asiento {candidate.entryRef} · {formatDate(candidate.entryDate)} ·{" "}
                                    {candidate.cuenta} · {candidate.concepto || "Sin concepto"}
                                  </span>
                                  <span className="text-graphite-500">{candidate.reason}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {movement.status === "PENDIENTE" && candidates.length === 0 && (
                          <p className="mt-3 border-t border-sand-100 pt-3 text-xs text-amber-700">
                            Sin coincidencias en cuentas 572/570. Comprueba que el asiento bancario esté contabilizado.
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="border-sand-200 bg-sand-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            Formato recomendado del banco
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-graphite-600">
          Exporta desde tu banco un CSV o Excel con columnas como{" "}
          <strong>Fecha</strong>, <strong>Concepto</strong>, <strong>Importe</strong> (o Cargo/Abono). Para PDF,
          se usará OCR sobre el texto del extracto.
        </CardContent>
      </Card>
    </div>
  )
}

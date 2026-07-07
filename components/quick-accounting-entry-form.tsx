"use client"

import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  CheckCircle2,
  Keyboard,
  Loader2,
  Plus,
  Scale,
  Trash2,
  Zap,
} from "lucide-react"
import type { AccountingCommandCode, AccountingEntryLine, EntryCellField } from "@/lib/types/accounting-entry"
import { ENTRY_CELL_FIELDS } from "@/lib/types/accounting-entry"
import {
  ACCOUNTING_COMMANDS,
  COMMAND_CODES,
  calculateTotals,
  createEmptyLine,
  formatEuro,
  linesFromTemplate,
  parseCommandInput,
  validateEntryLines,
} from "@/lib/accounting/command-templates"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "@/components/auth-provider"

function cellKey(row: number, field: EntryCellField): string {
  return `${row}-${field}`
}

function parseAmount(value: string): number {
  const normalized = value.replace(",", ".").trim()
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

export function QuickAccountingEntryForm() {
  const { activeCompany } = useAuth()
  const [commandInput, setCommandInput] = useState("")
  const [activeCommand, setActiveCommand] = useState<AccountingCommandCode | null>(null)
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [lines, setLines] = useState<AccountingEntryLine[]>([createEmptyLine()])
  const [commandHint, setCommandHint] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const totals = useMemo(() => calculateTotals(lines), [lines])
  const lineValidations = useMemo(() => validateEntryLines(lines), [lines])
  const validationByLine = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const v of lineValidations) {
      const existing = map.get(v.lineId) ?? []
      map.set(v.lineId, [...existing, v.message])
    }
    return map
  }, [lineValidations])

  const registerRef = useCallback((row: number, field: EntryCellField, el: HTMLInputElement | null) => {
    const key = cellKey(row, field)
    if (el) {
      inputRefs.current.set(key, el)
    } else {
      inputRefs.current.delete(key)
    }
  }, [])

  const focusCell = useCallback((row: number, field: EntryCellField) => {
    const el = inputRefs.current.get(cellKey(row, field))
    el?.focus()
    el?.select()
  }, [])

  const focusNextCell = useCallback(
    (row: number, field: EntryCellField) => {
      const fieldIndex = ENTRY_CELL_FIELDS.indexOf(field)
      if (fieldIndex < ENTRY_CELL_FIELDS.length - 1) {
        focusCell(row, ENTRY_CELL_FIELDS[fieldIndex + 1])
        return
      }
      if (row < lines.length - 1) {
        focusCell(row + 1, "cuenta")
      } else {
        const newLine = createEmptyLine()
        setLines((prev) => [...prev, newLine])
        requestAnimationFrame(() => focusCell(row + 1, "cuenta"))
      }
    },
    [focusCell, lines.length],
  )

  const applyCommand = useCallback(
    (code: AccountingCommandCode) => {
      setActiveCommand(code)
      setCommandInput(code)
      setCommandHint(null)
      setLines(linesFromTemplate(code))
      requestAnimationFrame(() => focusCell(0, "cuenta"))
    },
    [focusCell],
  )

  const handleCommandKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return
    event.preventDefault()

    const code = parseCommandInput(commandInput)
    if (code) {
      applyCommand(code)
      return
    }

    setCommandHint(`Comando no reconocido. Usa: ${COMMAND_CODES.join(", ")}`)
  }

  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    row: number,
    field: EntryCellField,
  ) => {
    if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
      event.preventDefault()
      focusNextCell(row, field)
    }
  }

  const updateLine = (lineId: string, patch: Partial<AccountingEntryLine>) => {
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)))
  }

  const removeLine = (lineId: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== lineId) : prev))
  }

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine()])
    requestAnimationFrame(() => focusCell(lines.length, "cuenta"))
  }

  const resetForm = useCallback(() => {
    setCommandInput("")
    setActiveCommand(null)
    setFecha(new Date().toISOString().split("T")[0])
    setLines([createEmptyLine()])
    setCommandHint(null)
    setSubmitError(null)
  }, [])

  const handleSubmit = async () => {
    if (!totals.isBalanced || isSubmitting) return
    if (!activeCompany) {
      setSubmitError("Selecciona una empresa activa antes de confirmar el asiento.")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(null)

    try {
      const data = await apiFetch<{
        success: true
        entry: { id: string; fecha: string }
      }>("/api/accounting/entries", {
        method: "POST",
        body: JSON.stringify({
          fecha,
          commandCode: activeCommand,
          lines: lines.map(({ cuenta, concepto, debe, haber }) => ({
            cuenta,
            concepto,
            debe,
            haber,
          })),
        }),
      })

      setSubmitSuccess(`Asiento guardado correctamente (${data.entry.fecha}).`)
      resetForm()
      requestAnimationFrame(() => focusCell(0, "cuenta"))
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo guardar el asiento.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-emerald-200">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-emerald-900">
                <Zap className="h-5 w-5" />
                Asiento rápido
              </CardTitle>
              <CardDescription>
                Escribe un código de comando y pulsa Enter. Navega con Tab o Enter sin soltar el teclado.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Keyboard className="h-3 w-3" />
              Modo teclado
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[140px_1fr]">
            <div className="space-y-2">
              <label htmlFor="entry-fecha" className="text-sm font-medium">
                Fecha
              </label>
              <Input
                id="entry-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="entry-command" className="text-sm font-medium">
                Código de comando
              </label>
              <Input
                id="entry-command"
                value={commandInput}
                onChange={(e) => {
                  setCommandInput(e.target.value)
                  setCommandHint(null)
                }}
                onKeyDown={handleCommandKeyDown}
                placeholder="17, 34, 16 o 57 — Enter para cargar"
                className="font-mono text-lg tracking-widest"
                autoComplete="off"
              />
              {activeCommand && (
                <p className="text-sm text-emerald-700">
                  {ACCOUNTING_COMMANDS[activeCommand].label} —{" "}
                  {ACCOUNTING_COMMANDS[activeCommand].description}
                </p>
              )}
              {commandHint && (
                <p className="text-sm text-amber-700" role="alert">
                  {commandHint}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {COMMAND_CODES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => applyCommand(code)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  activeCommand === code
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                    : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300"
                }`}
              >
                <span className="font-mono font-bold">{code}</span>{" "}
                {ACCOUNTING_COMMANDS[code].label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="w-28 px-3 py-2 font-medium">Cuenta</th>
                  <th className="px-3 py-2 font-medium">Concepto</th>
                  <th className="w-32 px-3 py-2 font-medium text-right">Debe</th>
                  <th className="w-32 px-3 py-2 font-medium text-right">Haber</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, rowIndex) => {
                  const warnings = validationByLine.get(line.id) ?? []
                  const hasWarning = warnings.length > 0

                  return (
                    <tr
                      key={line.id}
                      className={`border-b ${hasWarning ? "bg-amber-50/60" : "hover:bg-gray-50/50"}`}
                    >
                      <td className="px-2 py-1">
                        <Input
                          ref={(el) => registerRef(rowIndex, "cuenta", el)}
                          value={line.cuenta}
                          onChange={(e) => updateLine(line.id, { cuenta: e.target.value })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, "cuenta")}
                          className={`h-9 font-mono ${hasWarning ? "border-amber-400" : ""}`}
                          placeholder="430"
                          aria-label={`Cuenta línea ${rowIndex + 1}`}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          ref={(el) => registerRef(rowIndex, "concepto", el)}
                          value={line.concepto}
                          onChange={(e) => updateLine(line.id, { concepto: e.target.value })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, "concepto")}
                          className="h-9"
                          placeholder="Descripción"
                          aria-label={`Concepto línea ${rowIndex + 1}`}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          ref={(el) => registerRef(rowIndex, "debe", el)}
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debe || ""}
                          onChange={(e) =>
                            updateLine(line.id, { debe: parseAmount(e.target.value) })
                          }
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, "debe")}
                          className="h-9 text-right font-mono tabular-nums"
                          placeholder="0,00"
                          aria-label={`Debe línea ${rowIndex + 1}`}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          ref={(el) => registerRef(rowIndex, "haber", el)}
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.haber || ""}
                          onChange={(e) =>
                            updateLine(line.id, { haber: parseAmount(e.target.value) })
                          }
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, "haber")}
                          className="h-9 text-right font-mono tabular-nums"
                          placeholder="0,00"
                          aria-label={`Haber línea ${rowIndex + 1}`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length <= 1}
                          aria-label="Eliminar línea"
                        >
                          <Trash2 className="h-4 w-4 text-gray-400" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50 font-semibold">
                  <td colSpan={2} className="px-3 py-2 text-right text-gray-600">
                    Totales
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatEuro(totals.debe)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatEuro(totals.haber)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {lineValidations.length > 0 && (
            <div className="space-y-2 border-t bg-amber-50 px-4 py-3">
              {lineValidations.map((v, i) => (
                <p key={`${v.lineId}-${i}`} className="flex items-start gap-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {v.message}
                </p>
              ))}
            </div>
          )}

          {(submitError || submitSuccess) && (
            <div
              className={`border-t px-4 py-3 text-sm ${
                submitError ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"
              }`}
              role="status"
            >
              {submitError ?? submitSuccess}
            </div>
          )}

          <div
            className={`flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 ${
              totals.isBalanced
                ? "bg-emerald-50"
                : totals.debe > 0 || totals.haber > 0
                  ? "bg-red-50"
                  : "bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-2">
              {totals.isBalanced ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">Asiento cuadrado</span>
                </>
              ) : totals.debe > 0 || totals.haber > 0 ? (
                <>
                  <Scale className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium text-red-800">
                    Descuadrado: diferencia {formatEuro(Math.abs(totals.difference))}{" "}
                    ({totals.difference > 0 ? "más Debe" : "más Haber"})
                  </span>
                </>
              ) : (
                <span className="text-sm text-gray-500">Introduce importes en Debe y Haber</span>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-4 w-4" />
                Línea
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-emerald-700 hover:bg-emerald-800"
                disabled={!totals.isBalanced || isSubmitting || !activeCompany}
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  "Confirmar asiento"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

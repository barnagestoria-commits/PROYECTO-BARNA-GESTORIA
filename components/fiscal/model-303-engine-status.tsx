"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface EngineIssue {
  code: string
  message: string
  severity: "error" | "warning"
}

interface Model303EnginePayload {
  success: true
  engine: {
    engine: "@gestoria/tax-engine"
    modelCode: "303"
    versionKey: string
    format: "dr303-envelope"
    filename: string
    byteLength: number
    valid: boolean
    issues: EngineIssue[]
    casillas: Array<{ code: string; amount: number; sourceCount: number }>
    source: {
      label: string
      url: string
      revision: string
      sha256Prefix: string
    }
  } | null
}

interface Model303EngineStatusProps {
  modelParam: string
  year: number
  quarterParam: string
  refreshKey: number
}

export function Model303EngineStatus({
  modelParam,
  year,
  quarterParam,
  refreshKey,
}: Model303EngineStatusProps) {
  const [payload, setPayload] = useState<Model303EnginePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    apiFetch<Model303EnginePayload>(
      `/api/fiscal/models/${modelParam}/${year}/${quarterParam}/draft-validation?t=${refreshKey}`,
    )
      .then((result) => {
        if (active) setPayload(result)
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "No se pudo validar el borrador DR303.")
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [modelParam, quarterParam, refreshKey, year])

  const engine = payload?.engine
  const sourceCount = engine?.casillas.reduce((sum, casilla) => sum + casilla.sourceCount, 0) ?? 0

  return (
    <section className="border border-[#1a4480] bg-white" aria-label="Estado del motor AEAT 303">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#dce6ef] px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#1a4480]" />
          <div>
            <p className="text-sm font-bold text-[#1a4480]">Motor AEAT DR303</p>
            <p className="text-xs text-slate-600">
              Validación del fichero oficial. Abajo eliges si presentas en la Sede o con ficheros.
            </p>
          </div>
        </div>

        {loading ? (
          <span className="flex items-center gap-2 text-xs text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando…
          </span>
        ) : engine ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              engine.valid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800",
            )}
          >
            {engine.valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {engine.valid ? "DR303 válido" : "Requiere revisión"}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-1">
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {!loading && !error && !engine ? (
            <p className="text-sm text-amber-700">
              No hay un diseño DR303 registrado para este ejercicio.
            </p>
          ) : null}
          {engine ? (
            <>
              <p className="truncate font-medium text-slate-900">{engine.filename}</p>
              <p className="text-xs text-slate-600">
                Revisión {engine.source.revision} · {engine.casillas.length} casillas ·{" "}
                {sourceCount} referencias contables · {engine.byteLength.toLocaleString("es-ES")} bytes
              </p>
              <a
                href={engine.source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#1a4480] underline"
              >
                {engine.source.label}
                <ExternalLink className="h-3 w-3" />
              </a>
              {engine.issues.length > 0 ? (
                <ul className="pt-1 text-xs text-amber-800">
                  {engine.issues.map((issue) => (
                    <li key={issue.code}>{issue.message}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="flex items-center">
          {engine?.valid ? (
            <p className="max-w-[16rem] text-xs text-slate-600">
              El .303 y los libros Excel están listos abajo. Tú eliges cómo presentar.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

"use client"

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { apiFormFetch } from "@/lib/api-client"
import {
  censusDocumentKindLabel,
  contrastCensus,
  parseStoredCensusReading,
  type CensusReading,
  type CensusSuggestion,
} from "@/lib/company/census-document"
import {
  CORPORATE_TAX_CHARACTER_OPTIONS,
  corporateTaxCharacterLabel,
  type CorporateTaxCharacter,
} from "@/lib/company/corporate-tax"
import type { CompanySiiMode } from "@/lib/company/sii"

export interface CorporateCensusProfile {
  cif: string | null
  cnae: string | null
  corporateTaxCharacter: CorporateTaxCharacter
  siiMode: CompanySiiMode
  cashBasisSubject: boolean
}

export function CorporateCensusFields({
  companyId,
  profile,
  storedFileName,
  storedExtractedAt,
  storedExtractedJson,
  disabled = false,
  onCharacterChange,
  onApply,
}: {
  companyId: string
  profile: CorporateCensusProfile
  storedFileName?: string | null
  storedExtractedAt?: string | null
  storedExtractedJson?: string | null
  disabled?: boolean
  onCharacterChange?: (value: CorporateTaxCharacter) => void
  onApply?: (input: {
    suggestion: CensusSuggestion
    document: { fileName: string; reading: CensusReading }
  }) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fresh, setFresh] = useState<{ fileName: string; reading: CensusReading } | null>(null)
  const [applied, setApplied] = useState(false)

  const storedReading = useMemo(
    () => parseStoredCensusReading(storedExtractedJson),
    [storedExtractedJson],
  )
  const reading = fresh?.reading ?? storedReading
  const fileName = fresh?.fileName ?? storedFileName ?? null
  const contrast = reading ? contrastCensus(profile, reading) : null

  const upload = async (file: File) => {
    setUploading(true)
    setError(null)
    setApplied(false)
    try {
      const body = new FormData()
      body.set("file", file)
      body.set("companyId", companyId)
      const result = await apiFormFetch<{ fileName: string; reading: CensusReading }>(
        "/api/company/census-document",
        body,
      )
      setFresh({ fileName: result.fileName, reading: result.reading })
    } catch (uploadError) {
      setFresh(null)
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo leer el documento.")
    } finally {
      setUploading(false)
    }
  }

  const suggestion = contrast?.suggestion
  const hasChanges = Boolean(suggestion && Object.keys(suggestion).length > 0)

  return (
    <div className="space-y-3 rounded-xl border border-sand-200 bg-white p-3" data-tour="onboarding-census">
      <div>
        <p className="text-sm font-medium text-pine-900">Censo para el impuesto sobre sociedades</p>
        <p className="mt-1 text-xs leading-relaxed text-graphite-500">
          El modelo 200 cambia de páginas según el tipo de entidad. Sube el modelo 036, el 037 o el
          certificado de situación censal para contrastar el NIF, el CNAE y el carácter con esta ficha.
          El certificado es el documento que emite la AEAT con el censo vigente. El PDF tiene que llevar
          texto: una foto no se puede leer.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium uppercase tracking-wide text-graphite-500">
          Carácter de la entidad
        </Label>
        {disabled ? (
          <p className="text-sm font-medium text-pine-900">
            {corporateTaxCharacterLabel(profile.corporateTaxCharacter)}
          </p>
        ) : (
          <select
            value={profile.corporateTaxCharacter}
            onChange={(event) => onCharacterChange?.(event.target.value as CorporateTaxCharacter)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {CORPORATE_TAX_CHARACTER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {disabled ? null : (
        <label className="flex cursor-pointer flex-col gap-1 text-sm text-pine-900">
          <span className="text-xs font-medium uppercase tracking-wide text-graphite-500">
            Documento censal
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={uploading}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-800"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void upload(file)
            }}
          />
        </label>
      )}

      {uploading ? (
        <p className="flex items-center gap-2 text-sm text-graphite-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Leyendo el documento…
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      {contrast && reading ? (
        <div className="space-y-2">
          <p className="text-xs text-graphite-500">
            {censusDocumentKindLabel(reading.kind)}
            {fileName ? ` · ${fileName}` : ""}
            {!fresh && storedExtractedAt ? ` · ${formatStamp(storedExtractedAt)}` : ""}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-graphite-500">
                  <th className="py-1 pr-3 font-medium">Dato</th>
                  <th className="py-1 pr-3 font-medium">Ficha</th>
                  <th className="py-1 font-medium">Documento</th>
                </tr>
              </thead>
              <tbody>
                {contrast.rows.map((row) => (
                  <tr key={row.field} className="border-t border-sand-100">
                    <td className="py-1.5 pr-3 text-graphite-500">{row.label}</td>
                    <td className="py-1.5 pr-3 font-medium text-pine-900">{row.profile}</td>
                    <td
                      className={`py-1.5 font-medium ${
                        row.status === "match" ? "text-emerald-800" : "text-amber-800"
                      }`}
                    >
                      {row.document}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!contrast.nifMatches ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              Este documento es de otro NIF. No se copian sus datos a esta empresa.
            </p>
          ) : null}
          {contrast.nifMatches && hasChanges && !applied ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (!suggestion || !fileName) return
                onApply?.({ suggestion, document: { fileName, reading } })
                setApplied(true)
              }}
            >
              Copiar a la ficha lo que no coincide
            </Button>
          ) : null}
          {contrast.nifMatches && !hasChanges ? (
            <p className="text-sm text-emerald-800">La ficha coincide con el documento.</p>
          ) : null}
          {applied ? (
            <p className="text-sm text-emerald-800">
              Contraste apuntado. Guarda la ficha para conservarlo.
            </p>
          ) : null}
          {fresh && contrast.nifMatches && !hasChanges && !applied ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onApply?.({ suggestion: {}, document: { fileName: fresh.fileName, reading } })
                setApplied(true)
              }}
            >
              Dejar constancia en la ficha
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function formatStamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("es-ES")
}

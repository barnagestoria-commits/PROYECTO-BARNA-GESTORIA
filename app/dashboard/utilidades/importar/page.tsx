"use client"

import { useState } from "react"
import { FileUpload, type AccountingImportResult } from "@/components/file-upload"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload } from "lucide-react"

export default function ImportarDatosPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-900">
            <Upload className="h-5 w-5" />
            Importar datos contables
          </CardTitle>
          <CardDescription>
            Importa movimientos desde Excel (.xlsx / .xls) o CSV exportados de contabilidad externa.
            También disponible desde el centro de subida del panel de documentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <FileUpload
            onFilesSelected={() => {
              // Esta pantalla prioriza la importación contable vía Excel/CSV.
            }}
            onAccountingImport={(result: AccountingImportResult) => {
              setError(null)
              setMessage(
                `Importación completada (${result.format.toUpperCase()}): ${result.rowsImported} líneas → ${result.entriesCreated} asientos en el diario.`,
              )
            }}
            onImportError={(importError) => {
              setMessage(null)
              setError(importError)
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

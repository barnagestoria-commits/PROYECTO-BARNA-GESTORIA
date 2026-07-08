"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { apiFormFetch } from "@/lib/api-client"
import { FileUp, Loader2, Upload } from "lucide-react"

export default function ImportarDatosPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImport = async () => {
    if (!file) return
    setIsUploading(true)
    setMessage(null)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      const data = await apiFormFetch<{
        success: true
        import: { rowsImported: number; entriesCreated: number; fileName: string }
      }>("/api/imports/accounting", formData)
      setMessage(
        `Importación completada: ${data.import.rowsImported} líneas → ${data.import.entriesCreated} asientos.`,
      )
      setFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en la importación.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-900">
            <Upload className="h-5 w-5" />
            Importar datos contables
          </CardTitle>
          <CardDescription>
            Sube archivos CSV o Excel exportados desde contabilidad externa. Columnas: fecha, cuenta, concepto, debe, haber.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-emerald-200 bg-emerald-50/30 p-8 transition-colors hover:bg-emerald-50/60">
            <FileUp className="h-8 w-8 text-emerald-600" />
            <span className="text-sm text-gray-600">
              {file ? file.name : "Seleccionar CSV o Excel"}
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <Button
            onClick={handleImport}
            disabled={!file || isUploading}
            className="w-full bg-emerald-700 hover:bg-emerald-800"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando…
              </>
            ) : (
              "Importar y crear asientos"
            )}
          </Button>

          {message && <p className="text-sm text-emerald-800">{message}</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

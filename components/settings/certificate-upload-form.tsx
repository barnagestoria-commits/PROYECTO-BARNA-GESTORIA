"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { FileKey2, Loader2, ShieldCheck, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { CertificateUploadPayload, VerifactuEnvironment } from "@/lib/settings/certificate-storage"

interface CertificateUploadFormProps {
  onSave: (payload: CertificateUploadPayload) => Promise<void>
  onTestSignature: () => Promise<void>
  hasCertificate: boolean
  isSaving?: boolean
  isTesting?: boolean
}

export function CertificateUploadForm({
  onSave,
  onTestSignature,
  hasCertificate,
  isSaving = false,
  isTesting = false,
}: CertificateUploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState("")
  const [environment, setEnvironment] = useState<VerifactuEnvironment>("sandbox")
  const [feedback, setFeedback] = useState<string | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    const next = accepted[0] ?? null
    setFile(next)
    setFeedback(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "application/x-pkcs12": [".p12", ".pfx"],
      "application/octet-stream": [".p12", ".pfx"],
    },
  })

  const handleSave = async () => {
    if (!file) {
      setFeedback("Selecciona un archivo .p12 o .pfx.")
      return
    }
    if (!password.trim()) {
      setFeedback("Introduce la contraseña del certificado.")
      return
    }

    setFeedback(null)
    await onSave({
      fileName: file.name,
      password: password.trim(),
      environment,
    })
    setPassword("")
    setFile(null)
  }

  const handleTest = async () => {
    setFeedback(null)
    await onTestSignature()
  }

  return (
    <Card className="border-sand-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg text-pine-900">Subir certificado digital</CardTitle>
        <CardDescription>
          El archivo se encriptará en el servidor. Solo se almacenan metadatos en esta demo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          {...getRootProps()}
          className={cn(
            "cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            isDragActive
              ? "border-emerald-400 bg-emerald-50/60"
              : "border-sand-300 bg-sand-50/40 hover:border-emerald-300 hover:bg-emerald-50/30",
          )}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto mb-3 h-8 w-8 text-emerald-700" />
          <p className="text-sm font-medium text-pine-900">
            {isDragActive ? "Suelta el certificado aquí" : "Arrastra tu certificado .p12 / .pfx"}
          </p>
          <p className="mt-1 text-xs text-graphite-500">o haz clic para seleccionar archivo</p>
          {file && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-800 shadow-sm">
              <FileKey2 className="h-3.5 w-3.5" />
              {file.name}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="cert-password">Contraseña del certificado</Label>
            <Input
              id="cert-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
              placeholder="Contraseña del archivo .p12 / .pfx"
              autoComplete="new-password"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="cert-environment">Entorno Verifactu / AEAT</Label>
            <select
              id="cert-environment"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as VerifactuEnvironment)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="sandbox">Modo Pruebas / Sandbox AEAT</option>
              <option value="production">Modo Producción Real</option>
            </select>
          </div>
        </div>

        {feedback && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {feedback}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="bg-emerald-800 hover:bg-pine-900"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar y Encriptar Certificado
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={!hasCertificate || isTesting}
          >
            {isTesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Probar Firma de Test
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

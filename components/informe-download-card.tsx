"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { Download, FileText, Loader2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface InformeDownloadCardProps {
  title: string
  description: string
  icon: LucideIcon
  formats?: string[]
}

export function InformeDownloadCard({
  title,
  description,
  icon: Icon,
  formats = ["PDF", "Excel"],
}: InformeDownloadCardProps) {
  const { activeCompany } = useAuth()

  return (
    <Card className="border-emerald-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-emerald-900">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!activeCompany ? (
          <p className="text-sm text-amber-700">Selecciona una empresa activa para generar el informe.</p>
        ) : (
          <p className="text-sm text-gray-600">
            Empresa: <span className="font-medium text-gray-900">{activeCompany.name}</span>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {formats.map((format) => (
            <Button
              key={format}
              variant="outline"
              size="sm"
              disabled={!activeCompany}
              className="gap-2 border-emerald-200 hover:bg-emerald-50"
              onClick={() => {
                // TODO: conectar generación real desde asientos contables
              }}
            >
              <Download className="h-4 w-4" />
              Descargar {format}
            </Button>
          ))}
        </div>

        <p className="flex items-center gap-2 text-xs text-gray-500">
          <FileText className="h-3.5 w-3.5" />
          Los datos se calcularán desde los asientos contables registrados.
        </p>
      </CardContent>
    </Card>
  )
}

export function InformePageSkeleton({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      Preparando {label}…
    </div>
  )
}

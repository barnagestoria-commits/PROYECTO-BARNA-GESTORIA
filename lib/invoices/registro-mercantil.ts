import type { GestoriaEntityType } from "@prisma/client"
import type { RegistroMercantilData } from "@/lib/invoices/types"

export function isSociedadMercantil(entityType: GestoriaEntityType | string): boolean {
  return entityType === "PERSONA_JURIDICA"
}

export function hasRegistroMercantil(data: RegistroMercantilData | null | undefined): boolean {
  return hasRegistroMercantilData(data)
}

export function hasRegistroMercantilData(data: RegistroMercantilData | null | undefined): boolean {
  if (!data) return false
  return Boolean(
    data.tomo?.trim() ||
      data.libro?.trim() ||
      data.folio?.trim() ||
      data.hoja?.trim() ||
      data.inscripcion?.trim(),
  )
}

/** Texto legal para pie de factura según Código de Comercio (sociedades). */
export function formatRegistroMercantilLine(
  data: RegistroMercantilData | null | undefined,
  fallbackProvince?: string,
): string | null {
  if (!hasRegistroMercantil(data)) return null

  const provincia = data!.provincia?.trim() || fallbackProvince?.trim() || "—"
  const parts: string[] = [`Inscrita en el Registro Mercantil de ${provincia}`]

  const entries: Array<[string, string | undefined]> = [
    ["Tomo", data!.tomo],
    ["Libro", data!.libro],
    ["Folio", data!.folio],
    ["Hoja", data!.hoja],
    ["Sección", data!.seccion],
    ["Inscripción", data!.inscripcion],
  ]

  for (const [label, value] of entries) {
    const trimmed = value?.trim()
    if (trimmed) parts.push(`${label} ${trimmed}`)
  }

  return parts.join(", ") + "."
}

export function createEmptyRegistroMercantil(province = ""): RegistroMercantilData {
  return {
    provincia: province,
    tomo: "",
    libro: "",
    folio: "",
    hoja: "",
    seccion: "",
    inscripcion: "",
  }
}

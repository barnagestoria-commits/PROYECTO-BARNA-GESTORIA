import type { FiscalModelId } from "@/lib/types/fiscal-panorama"

/** Referencias oficiales AEAT para diseños de registro y desarrollo. */
export const AEAT_OFFICIAL_PORTALS = {
  /** Portal de desarrolladores y sandbox (servicios web, simulación). */
  developerSandbox: "https://www.agenciatributaria.es/AEAT.desarrolladores/",
  /** Índice de diseños de registro BOE (500 posiciones por modelo). */
  recordDesignsIndex:
    "https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro.html",
  recordDesignsManual:
    "https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/Ayudas/Disenyos_registro_Manual_uso.pdf",
  /** Pre303 — importación y validación de autoliquidaciones IVA en la sede. */
  pre303Service: "https://sede.agenciatributaria.gob.es/Sede/iva/pre-303.html",
} as const

export interface AeatModelOfficialSource {
  modelCode: FiscalModelId
  label: string
  /** Formato BOE de presentación por fichero (registros de 500 posiciones). */
  submissionFormat: "boe-500" | "xml-ws"
  /** Extensión del fichero de importación en la sede (p. ej. .303, .111). */
  boeFileExtension: string
  recordDesignPath?: string
  instructionsPath?: string
  presentationPath?: string
}

const MODEL_303: AeatModelOfficialSource = {
  modelCode: "303",
  label: "IVA — Autoliquidación trimestral",
  submissionFormat: "boe-500",
  boeFileExtension: ".303",
  recordDesignPath:
    "https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro.html",
  instructionsPath:
    "https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/iva/modelo-303-iva-autoliquidacion_/instrucciones-2026.html",
  presentationPath:
    "https://sede.agenciatributaria.gob.es/Sede/iva/presentar-declaracion-iva-modelo-303.html",
}

export const AEAT_MODEL_OFFICIAL_SOURCES: Partial<Record<FiscalModelId, AeatModelOfficialSource>> = {
  "111": {
    modelCode: "111",
    label: "Retenciones IRPF — trimestral",
    submissionFormat: "boe-500",
    boeFileExtension: ".111",
    recordDesignPath: AEAT_OFFICIAL_PORTALS.recordDesignsIndex,
  },
  "115": {
    modelCode: "115",
    label: "Retenciones arrendamientos — trimestral",
    submissionFormat: "boe-500",
    boeFileExtension: ".115",
    recordDesignPath: AEAT_OFFICIAL_PORTALS.recordDesignsIndex,
  },
  "123": {
    modelCode: "123",
    label: "Retenciones capital mobiliario — trimestral",
    submissionFormat: "boe-500",
    boeFileExtension: ".123",
    recordDesignPath: AEAT_OFFICIAL_PORTALS.recordDesignsIndex,
  },
  "180": {
    modelCode: "180",
    label: "Retenciones IRPF — anual",
    submissionFormat: "boe-500",
    boeFileExtension: ".180",
    recordDesignPath: AEAT_OFFICIAL_PORTALS.recordDesignsIndex,
  },
  "190": {
    modelCode: "190",
    label: "Resumen anual retenciones IRPF",
    submissionFormat: "boe-500",
    boeFileExtension: ".190",
    recordDesignPath: AEAT_OFFICIAL_PORTALS.recordDesignsIndex,
  },
  "303": MODEL_303,
  "347": {
    modelCode: "347",
    label: "Operaciones con terceros — anual",
    submissionFormat: "boe-500",
    boeFileExtension: ".347",
    recordDesignPath: AEAT_OFFICIAL_PORTALS.recordDesignsIndex,
  },
  "349": {
    modelCode: "349",
    label: "Recapitulativa intracomunitaria — trimestral",
    submissionFormat: "boe-500",
    boeFileExtension: ".349",
    recordDesignPath: AEAT_OFFICIAL_PORTALS.recordDesignsIndex,
  },
  "390": {
    modelCode: "390",
    label: "Resumen anual IVA",
    submissionFormat: "boe-500",
    boeFileExtension: ".390",
    recordDesignPath: AEAT_OFFICIAL_PORTALS.recordDesignsIndex,
  },
}

export function getAeatModelOfficialSource(modelCode: FiscalModelId): AeatModelOfficialSource | null {
  return AEAT_MODEL_OFFICIAL_SOURCES[modelCode] ?? null
}

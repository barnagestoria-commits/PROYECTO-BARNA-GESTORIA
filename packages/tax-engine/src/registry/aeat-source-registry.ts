import type { AeatOfficialSourceMeta } from "../types"

const MODEL_303_2026: AeatOfficialSourceMeta = {
  id: "AEAT:303:2026:DR303e26v101",
  modelCode: "303",
  exercise: 2026,
  revision: "101",
  label: "DR303e26v101 — IVA autoliquidación 2026",
  url: "https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/DR_300_399/archivos_26/DR303e26v101.xlsx",
  sha256Prefix: "0be8b156",
  effectiveFrom: "2026-01-28",
  format: "dr303-envelope",
}

const PRE303_LSI_2026: AeatOfficialSourceMeta = {
  id: "AEAT:303:2026:PRE303-LSI",
  modelCode: "303",
  exercise: 2026,
  revision: "LSI-2026",
  label: "Cálculo casillas IVA Pre303 / LSI 2026",
  url: "https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/IVA/Fact_registro/Libros_registro/CALCULO_CASILLAS_IVA_PRE303-LSI.xlsx",
  sha256Prefix: "700a42a3",
  effectiveFrom: "2026-01-01",
  format: "dr303-envelope",
}

export const AEAT_OFFICIAL_SOURCES: AeatOfficialSourceMeta[] = [MODEL_303_2026, PRE303_LSI_2026]

export class AeatSourceRegistry {
  private readonly byId = new Map(AEAT_OFFICIAL_SOURCES.map((source) => [source.id, source]))

  list(): AeatOfficialSourceMeta[] {
    return [...AEAT_OFFICIAL_SOURCES]
  }

  getById(id: string): AeatOfficialSourceMeta | null {
    return this.byId.get(id) ?? null
  }

  getActiveForModel(modelCode: string, exercise: number): AeatOfficialSourceMeta | null {
    return (
      AEAT_OFFICIAL_SOURCES.find(
        (source) => source.modelCode === modelCode && source.exercise === exercise && source.id.includes("DR303"),
      ) ??
      AEAT_OFFICIAL_SOURCES.find((source) => source.modelCode === modelCode && source.exercise === exercise) ??
      null
    )
  }

  buildVersionKey(modelCode: string, exercise: number, period: string, revision: string): string {
    return `AEAT:${modelCode}:${exercise}:${period}:${revision}`
  }
}

export const defaultAeatSourceRegistry = new AeatSourceRegistry()

export function getDefault303VersionKey(year: number, period: string): string {
  const source = defaultAeatSourceRegistry.getActiveForModel("303", year)
  return source?.id ?? defaultAeatSourceRegistry.buildVersionKey("303", year, period, "UNREGISTERED")
}

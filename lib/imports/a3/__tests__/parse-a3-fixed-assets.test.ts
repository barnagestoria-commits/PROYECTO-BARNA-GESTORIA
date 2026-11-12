import { describe, expect, it } from "vitest"
import {
  parseAamDatFixedAssets,
  parseTpPredefiAssetDefaults,
} from "@/lib/imports/a3/parse-a3-fixed-assets"

const AAM_HEADER = Buffer.alloc(128, 0)
AAM_HEADER.write("0~", 0, "latin1")
const AAM_RECORD_SIZE = 100

function writeM1Record(
  buffer: Buffer,
  offset: number,
  elementType: string,
  costCents: number,
  accumulatedCents: number,
  version = 0,
  packedYear = 2025,
): void {
  buffer.write("@`1", offset, "latin1")
  buffer[offset + 3] = version
  buffer.write(elementType, offset + 11, "latin1")
  buffer.writeUInt16LE(packedYear, offset + 12)
  buffer.writeUInt32LE(costCents, offset + 24)
  buffer.writeUInt32LE(accumulatedCents, offset + 36)
}

function buildAssetAam(options?: { version?: number; years?: number[]; element?: string }): Buffer {
  const years = options?.years ?? [2025]
  const version = options?.version ?? 0
  const element = options?.element ?? "1"
  const buffer = Buffer.alloc(AAM_HEADER.length + AAM_RECORD_SIZE * years.length)
  AAM_HEADER.copy(buffer, 0)

  years.forEach((year, index) => {
    writeM1Record(
      buffer,
      AAM_HEADER.length + index * AAM_RECORD_SIZE,
      element,
      21344001,
      index === years.length - 1 ? 10000000 : 8000000,
      version,
      year,
    )
  })

  return buffer
}

describe("parseAamDatFixedAssets", () => {
  it("returns empty array for buffers without @`1 records", () => {
    expect(parseAamDatFixedAssets(AAM_HEADER)).toEqual([])
  })

  it("reads one ficha from the annual history of an element", () => {
    const assets = parseAamDatFixedAssets(buildAssetAam({ years: [2019, 2020, 2021, 2022, 2025] }), {
      fiscalYear: 2025,
    })

    expect(assets).toHaveLength(1)
    expect(assets[0]).toMatchObject({
      code: "00000001",
      name: "Maquinaria",
      elementType: "1",
      acquisitionCost: 213440.01,
      accumulatedAmort: 100000,
      acquisitionDate: "2025-01-01",
      cuentaInmovilizado: "213000000000",
      cuentaAmortAcumulada: "281300000000",
      cuentaGastoAmort: "681300000000",
      isActive: true,
    })
  })

  it("reads the newer @`1\\x01 marker used by recent A3 exports", () => {
    const assets = parseAamDatFixedAssets(buildAssetAam({ version: 1, years: [2024, 2025, 2026] }), {
      fiscalYear: 2026,
    })
    expect(assets).toHaveLength(1)
    expect(assets[0]?.acquisitionDate).toBe("2026-01-01")
  })

  it("keeps two fichas of the same element when the acquisition cost differs", () => {
    const buffer = Buffer.alloc(AAM_HEADER.length + AAM_RECORD_SIZE * 4)
    AAM_HEADER.copy(buffer, 0)
    writeM1Record(buffer, 128, "1", 10000000, 2000000, 0, 2024)
    writeM1Record(buffer, 228, "1", 10000000, 3000000, 0, 2025)
    writeM1Record(buffer, 328, "1", 5000000, 1000000, 0, 2024)
    writeM1Record(buffer, 428, "1", 5000000, 1500000, 0, 2025)

    const assets = parseAamDatFixedAssets(buffer, { fiscalYear: 2025 })
    expect(assets).toHaveLength(2)
    expect(assets.map((asset) => asset.acquisitionCost).sort((a, b) => a - b)).toEqual([50000, 100000])
    expect(assets.find((asset) => asset.acquisitionCost === 100000)?.accumulatedAmort).toBe(30000)
  })

  it("assigns 21x / 281x / 681x according to the A3 element type", () => {
    const furniture = parseAamDatFixedAssets(buildAssetAam({ element: "2", years: [2023, 2024, 2025] }))
    expect(furniture[0]).toMatchObject({
      name: "Mobiliario",
      cuentaInmovilizado: "216000000000",
      cuentaAmortAcumulada: "281600000000",
      cuentaGastoAmort: "681600000000",
    })
  })

  it("reads asset names from @`2 blocks linked to @`3 codes", () => {
    const base = buildAssetAam({ years: [2023, 2024, 2025] })
    const extra = Buffer.alloc(200)
    extra.write("@`2\x00        ", 0, "latin1")
    extra.writeUInt16LE(2025, 12) // little-endian, también válido
    extra.write("Mobiliario oficinaSSSSSSSSSSSS", 20, "latin1")
    extra.write("@`3\x0000000001", 100, "latin1")
    extra.writeUInt16LE(2025, 112)

    const buffer = Buffer.concat([base, extra])
    const assets = parseAamDatFixedAssets(buffer, { fiscalYear: 2025 })

    expect(assets[0]?.name).toBe("Mobiliario oficina")
  })
})

describe("parseTpPredefiAssetDefaults", () => {
  it("prefers the inmovilizado accounts next to the amortisation command", () => {
    const buffer = Buffer.from(
      "A AMORTIZACION INMOV. MATERIAL            6813         D           2813         \n" +
        "47200000 IVA SOPORTADO                      47700000 IVA REPERCUTIDO             \n" +
        "I Compra a $                              21300000                               ",
      "latin1",
    )
    const defaults = parseTpPredefiAssetDefaults(buffer)

    expect(defaults.cuentaInmovilizado).toBe("213000000000")
    expect(defaults.cuentaAmortAcumulada).toBe("281300000000")
    expect(defaults.cuentaGastoAmort).toBe("681300000000")
  })
})

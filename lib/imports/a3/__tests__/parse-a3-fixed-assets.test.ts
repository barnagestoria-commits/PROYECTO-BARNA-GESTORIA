import { describe, expect, it } from "vitest"
import {
  parseAamDatFixedAssets,
  parseTpPredefiAssetDefaults,
} from "@/lib/imports/a3/parse-a3-fixed-assets"

const AAM_HEADER = Buffer.alloc(512, 0)
AAM_HEADER.write("0~", 0, "latin1")
const AAM_RECORD_SIZE = 100

function writeM1Record(
  buffer: Buffer,
  offset: number,
  elementType: string,
  costCents: number,
  accumulatedCents: number,
): void {
  buffer.write("@`1\x00", offset, "latin1")
  buffer.write(elementType, offset + 11, "latin1")
  buffer.writeUInt32LE(costCents, offset + 24)
  buffer.writeUInt32LE(accumulatedCents, offset + 36)
}

function buildSingleAssetAam(): Buffer {
  const buffer = Buffer.alloc(AAM_HEADER.length + AAM_RECORD_SIZE * 8)
  AAM_HEADER.copy(buffer, 0)

  for (let index = 0; index < 8; index++) {
    writeM1Record(
      buffer,
      AAM_HEADER.length + index * AAM_RECORD_SIZE,
      index < 5 ? "1" : "2",
      21344001,
      21344000,
    )
  }

  return buffer
}

describe("parseAamDatFixedAssets", () => {
  it("returns empty array for buffers without @`1 records", () => {
    expect(parseAamDatFixedAssets(AAM_HEADER)).toEqual([])
  })

  it("parses one asset from eight @`1 records", () => {
    const assets = parseAamDatFixedAssets(buildSingleAssetAam(), { fiscalYear: 2025 })

    expect(assets).toHaveLength(1)
    expect(assets[0]).toMatchObject({
      code: "00000001",
      name: "Activo 1",
      acquisitionCost: 213440.01,
      accumulatedAmort: 213440,
      usefulLifeMonths: 120,
      acquisitionDate: "2025-01-01",
      cuentaInmovilizado: "213000000000",
      cuentaAmortAcumulada: "281300000000",
      cuentaGastoAmort: "681300000000",
    })
  })

  it("reads asset names from @`2 blocks linked to @`3 codes", () => {
    const base = buildSingleAssetAam()
    const extra = Buffer.alloc(200)
    const m2Offset = base.length
    extra.write("@`2\x00        ", 0, "latin1")
    extra.write("Mobiliario oficinaSSSSSSSSSSSS", 20, "latin1")
    extra.write("@`3\x0000000001", 100, "latin1")

    const buffer = Buffer.concat([base, extra])
    const assets = parseAamDatFixedAssets(buffer, { fiscalYear: 2025 })

    expect(assets[0]?.name).toBe("Mobiliario oficina")
  })
})

describe("parseTpPredefiAssetDefaults", () => {
  it("extracts 21x/281x/681x accounts from TPREDEFI text", () => {
    const buffer = Buffer.from(
      "213000000000            281030060000            681030060000            ",
      "latin1",
    )
    const defaults = parseTpPredefiAssetDefaults(buffer)

    expect(defaults.cuentaInmovilizado).toBe("213000000000")
    expect(defaults.cuentaAmortAcumulada).toBe("281030060000")
    expect(defaults.cuentaGastoAmort).toBe("681030060000")
  })
})

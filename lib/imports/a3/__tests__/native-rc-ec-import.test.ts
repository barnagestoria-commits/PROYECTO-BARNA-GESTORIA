import { describe, expect, it } from "vitest"
import { parseNativeA3ExportFiles } from "@/lib/imports/a3/parse-a3-native-export"

const HEADER_SIZE = 512
const RECORD_SIZE = 132

function journalRecord(input: {
  group: number
  sequence: number
  dh: "D" | "H"
  amount: number
  concept: string
  marker: "RC" | "EC"
}): Buffer {
  const record = Buffer.alloc(RECORD_SIZE)
  record.fill(input.group, 14, 20)
  record[20] = 1
  record[22] = input.sequence
  record.write(input.concept, 26, 38, "latin1")
  const cents = Math.round(input.amount * 100)
  record.write(`${input.dh}${String(cents).padStart(14, "0")}`, 68, "latin1")
  record.write(input.marker, 92, "latin1")
  return record
}

function journalFile(records: Buffer[]): Buffer {
  const header = Buffer.alloc(HEADER_SIZE)
  header.write("0~")
  return Buffer.concat([header, ...records])
}

describe("A3 native RC/EC journal variant", () => {
  it("uses byte 22 roles and ignores header-only months", () => {
    const january = journalFile([
      journalRecord({ group: 1, sequence: 2, dh: "H", amount: 111, concept: "Su Fra. Nº. F2026-1", marker: "RC" }),
      journalRecord({ group: 1, sequence: 3, dh: "D", amount: 21, concept: "IVA S./PROVEEDOR PRUEBA F2026-1", marker: "RC" }),
      journalRecord({ group: 1, sequence: 5, dh: "H", amount: 10, concept: "Reten./PROVEEDOR PRUEBA F2026-1", marker: "RC" }),
      journalRecord({ group: 1, sequence: 6, dh: "D", amount: 100, concept: "Gasto a PROVEEDOR PRUEBA F2026-1", marker: "RC" }),
      journalRecord({ group: 2, sequence: 2, dh: "D", amount: 111, concept: "Nuestra Factura Nº V2026-1", marker: "EC" }),
      journalRecord({ group: 2, sequence: 3, dh: "H", amount: 21, concept: "IVA R./CLIENTE PRUEBA V2026-1", marker: "EC" }),
      journalRecord({ group: 2, sequence: 5, dh: "D", amount: 10, concept: "Reten./CLIENTE PRUEBA V2026-1", marker: "EC" }),
      journalRecord({ group: 2, sequence: 6, dh: "H", amount: 100, concept: "Ventas a CLIENTE PRUEBA V2026-1", marker: "EC" }),
    ])

    const result = parseNativeA3ExportFiles(
      new Map([
        ["0090961A.DAT", january],
        ["0090962A.DAT", Buffer.alloc(128)],
      ]),
      "E0090926",
    )

    expect(result.entries).toHaveLength(2)
    expect(result.warnings).not.toContain("No se pudieron leer asientos de 0090962A.DAT.")

    const receivedAccounts = result.entries[0]!.lines.map((line) => line.cuenta.slice(0, 3))
    const issuedAccounts = result.entries[1]!.lines.map((line) => line.cuenta.slice(0, 3))
    expect(receivedAccounts).toEqual(["400", "472", "475", "629"])
    expect(issuedAccounts).toEqual(["430", "477", "473", "705"])

    for (const entry of result.entries) {
      const debe = entry.lines.reduce((sum, line) => sum + line.debe, 0)
      const haber = entry.lines.reduce((sum, line) => sum + line.haber, 0)
      expect(debe).toBeCloseTo(haber, 2)
    }
  })
})

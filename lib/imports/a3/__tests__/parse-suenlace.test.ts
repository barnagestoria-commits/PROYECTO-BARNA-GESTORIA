import { describe, expect, it } from "vitest"
import { parseSuenlaceBuffer } from "@/lib/imports/a3/parse-suenlace-buffer"
import {
  buildBalancedExpenseEntry,
  buildSubaccountRecord,
  buildSuenlaceRecord,
} from "@/lib/imports/a3/__tests__/fixtures/suenlace-builder"
import { validateAllEntriesBalanced, aggregateAccountTotals } from "@/lib/accounting/import-validation"

describe("parseSuenlaceBuffer", () => {
  it("agrupa líneas I/M/U en un asiento equilibrado", () => {
    const buffer = Buffer.from(buildBalancedExpenseEntry(), "latin1")
    const parsed = parseSuenlaceBuffer(buffer)

    expect(parsed.entries).toHaveLength(1)
    expect(parsed.entries[0].lines).toHaveLength(3)

    const balanceIssues = validateAllEntriesBalanced(parsed.entries)
    expect(balanceIssues).toHaveLength(0)
  })

  it("conserva los códigos de cuenta reales del fichero", () => {
    const buffer = Buffer.from(buildBalancedExpenseEntry({ gastoCuenta: "629000000007" }), "latin1")
    const parsed = parseSuenlaceBuffer(buffer)

    const cuentas = parsed.entries[0].lines.map((line) => line.cuenta)
    expect(cuentas).toContain("629000000007")
    expect(cuentas).not.toContain("629000000000")
  })

  it("asigna debe/haber según tipo de registro 0 con D/H", () => {
    const buffer = Buffer.from(
      buildSuenlaceRecord({
        fecha: "20250115",
        recordType: "0",
        cuenta: "572000000001",
        dh: "D",
        concepto: "Cobro",
        importe: "+0000000100.00",
      }),
      "latin1",
    )
    const parsed = parseSuenlaceBuffer(buffer)
    expect(parsed.entries[0].lines[0].debe).toBe(100)
    expect(parsed.entries[0].lines[0].haber).toBe(0)
  })

  it("tipo 9 con cargoAbono A asigna al haber", () => {
    const buffer = Buffer.from(
      buildSuenlaceRecord({
        fecha: "20250115",
        recordType: "9",
        cuenta: "430000000001",
        dh: "A",
        concepto: "Abono cliente",
        importe: "+0000000250.00",
      }),
      "latin1",
    )
    const parsed = parseSuenlaceBuffer(buffer)
    expect(parsed.entries[0].lines[0].haber).toBe(250)
    expect(parsed.entries[0].lines[0].debe).toBe(0)
  })

  it("tipos 1 y 2 siempre van al debe", () => {
    for (const recordType of ["1", "2"] as const) {
      const buffer = Buffer.from(
        buildSuenlaceRecord({
          fecha: "20250115",
          recordType,
          cuenta: "629000000001",
          dh: "H",
          concepto: "Gasto",
          importe: "+0000000075.00",
        }),
        "latin1",
      )
      const parsed = parseSuenlaceBuffer(buffer)
      expect(parsed.entries[0].lines[0].debe).toBe(75)
    }
  })

  it("extrae subcuentas tipo C", () => {
    const buffer = Buffer.from(
      buildSubaccountRecord("629000000003", "SERVICIOS VARIOS") +
        buildBalancedExpenseEntry({ gastoCuenta: "629000000003" }),
      "latin1",
    )
    const parsed = parseSuenlaceBuffer(buffer)

    expect(parsed.subaccounts.some((sub) => sub.accountCode === "629000000003")).toBe(true)
  })

  it("agrega totales por cuenta correctamente", () => {
    const buffer = Buffer.from(
      buildBalancedExpenseEntry({ base: 200, iva: 42, gastoCuenta: "629000000003" }),
      "latin1",
    )
    const parsed = parseSuenlaceBuffer(buffer)
    const totals = aggregateAccountTotals(parsed.entries)

    const gasto = totals.find((row) => row.cuenta === "629000000003")
    const iva = totals.find((row) => row.cuenta === "472000000001")
    const proveedor = totals.find((row) => row.cuenta === "400000000523")

    expect(gasto?.totalDebe).toBe(200)
    expect(iva?.totalDebe).toBe(42)
    expect(proveedor?.totalHaber).toBe(242)
  })
})

import { describe, expect, it } from "vitest"
import { calculateTaxSummary, type RawEntryLine } from "@/lib/fiscal/tax-summary"
import { calculateModelAmount } from "@/lib/fiscal/panorama"

function line(
  partial: Partial<RawEntryLine> & Pick<RawEntryLine, "concepto" | "debe" | "haber">,
): RawEntryLine {
  return {
    id: partial.id ?? "line-1",
    entryId: partial.entryId ?? "entry-1",
    cuenta: partial.cuenta ?? "473000000000",
    concepto: partial.concepto,
    debe: partial.debe,
    haber: partial.haber,
    entry: partial.entry ?? {
      id: "entry-1",
      fecha: new Date("2026-01-10T12:00:00.000Z"),
      concepto: null,
    },
  }
}

describe("calculateTaxSummary", () => {
  it("matches A3 A ingresar: retenciones plus IVA only when IVA is positive", () => {
    const lines: RawEntryLine[] = [
      line({
        id: "111",
        concepto: '"Reten./BARBA YESTE, NICOLÁS   103',
        haber: 4178.94,
        debe: 0,
        entry: { id: "e111", fecha: new Date("2026-02-01T12:00:00.000Z"), concepto: null },
      }),
      line({
        id: "123",
        concepto: "RETENCION DIVIDENDOS",
        haber: 22870.38,
        debe: 0,
        entry: { id: "e123", fecha: new Date("2026-02-20T12:00:00.000Z"), concepto: null },
      }),
      line({
        id: "303",
        concepto: "Modelo 303 1 Trimestre 1 m",
        cuenta: "555000000000",
        debe: 96059.91,
        haber: 0,
        entry: { id: "e303", fecha: new Date("2026-03-01T12:00:00.000Z"), concepto: "Modelo 303 1 Trimestre" },
      }),
    ]

    expect(calculateModelAmount("111", lines, 2026, 1).amount).toBe(4178.94)
    expect(calculateModelAmount("303", lines, 2026, 1).amount).toBe(-96059.91)

    const summary = calculateTaxSummary(lines, 2026, 1)
    expect(summary.totalAPagarDevolver).toBe(27049.32)
    expect(summary.label).toBe("A ingresar")
  })
})

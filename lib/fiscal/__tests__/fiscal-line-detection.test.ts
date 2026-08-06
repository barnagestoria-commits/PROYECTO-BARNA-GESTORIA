import { describe, expect, it } from "vitest"
import { calculateModelAmount, type RawEntryLine } from "@/lib/fiscal/panorama"
import {
  extractModel303LiquidationAmount,
  isModel111RetentionLine,
  isModel123DividendRetentionLine,
} from "@/lib/fiscal/fiscal-line-detection"

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
    entry: partial.entry ?? { id: "entry-1", fecha: new Date("2026-02-15T12:00:00.000Z"), concepto: null },
  }
}

describe("fiscal line detection", () => {
  it("detects modelo 111 by Reten./ concept", () => {
    expect(
      isModel111RetentionLine(
        line({ concepto: '"Reten./BARBA YESTE, NICOLÁS 103', debe: 0, haber: 178.5 }),
      ),
    ).toBe(true)
    expect(
      isModel123DividendRetentionLine(
        line({ concepto: "RETENCION DIVIDENDOS", debe: 0, haber: 22870.38 }),
      ),
    ).toBe(true)
  })

  it("extracts modelo 303 liquidation amounts like A3", () => {
    const lines: RawEntryLine[] = [
      line({
        id: "q1",
        concepto: "Modelo 303 1 Trimestre 1",
        cuenta: "555000000000",
        debe: 96059.91,
        haber: 0,
        entry: { id: "e1", fecha: new Date("2026-03-05T12:00:00.000Z"), concepto: "Modelo 303 1 Trimestre" },
      }),
      line({
        id: "q1-pay",
        concepto: "Modelo 303 1 Trimestre 1",
        cuenta: "572000000000",
        debe: 0,
        haber: 258395.68,
        entry: {
          id: "e1-pay",
          fecha: new Date("2026-03-05T12:00:00.000Z"),
          concepto: "Modelo 303 1 Trimestre",
        },
      }),
      line({
        id: "q1-supplier",
        concepto: "Modelo 303 1 Trimestre 1",
        cuenta: "400000000475",
        debe: 162335.77,
        haber: 0,
        entry: {
          id: "e1-pay",
          fecha: new Date("2026-03-05T12:00:00.000Z"),
          concepto: "Modelo 303 1 Trimestre",
        },
      }),
      line({
        id: "q2",
        concepto: "Modelo 303 2 Trimestre 2",
        cuenta: "572000000000",
        debe: 0,
        haber: 110116.19,
        entry: { id: "e2", fecha: new Date("2026-06-23T12:00:00.000Z"), concepto: "Modelo 303 2 Trimestre" },
      }),
      line({
        id: "q2-pay",
        concepto: "Modelo 303 2 Trimestre 2",
        cuenta: "572000000000",
        debe: 0,
        haber: 191159.01,
        entry: {
          id: "e2-pay",
          fecha: new Date("2026-06-23T12:00:00.000Z"),
          concepto: "Modelo 303 2 Trimestre",
        },
      }),
      line({
        id: "q2-supplier",
        concepto: "Modelo 303 2 Trimestre 2",
        cuenta: "400000000475",
        debe: 397335.11,
        haber: 0,
        entry: {
          id: "e2-pay",
          fecha: new Date("2026-06-23T12:00:00.000Z"),
          concepto: "Modelo 303 2 Trimestre",
        },
      }),
      line({
        id: "q2-comp",
        concepto: "Cuotas compensar aplicadas 2",
        cuenta: "572000000000",
        debe: 0,
        haber: 96059.91,
        entry: {
          id: "e2-pay",
          fecha: new Date("2026-06-23T12:00:00.000Z"),
          concepto: "Modelo 303 2 Trimestre",
        },
      }),
    ]

    expect(extractModel303LiquidationAmount(lines, 2026, 1)).toBe(-96059.91)
    expect(extractModel303LiquidationAmount(lines, 2026, 2)).toBe(110116.19)
  })

  it("calculates 111 and 123 from concepts instead of 4731 prefix", () => {
    const lines: RawEntryLine[] = [
      line({
        id: "111",
        concepto: '"Reten./RIUS SANCHIS, ELISABET 01/26',
        cuenta: "473000000000",
        debe: 0,
        haber: 551.25,
        entry: { id: "e111", fecha: new Date("2026-01-10T12:00:00.000Z"), concepto: null },
      }),
      line({
        id: "123",
        concepto: "RETENCION DIVIDENDOS",
        cuenta: "572000000000",
        debe: 0,
        haber: 22870.38,
        entry: { id: "e123", fecha: new Date("2026-02-20T12:00:00.000Z"), concepto: null },
      }),
    ]

    expect(calculateModelAmount("111", lines, 2026, 1).amount).toBe(551.25)
    expect(calculateModelAmount("123", lines, 2026, 1).amount).toBe(22870.38)
  })
})

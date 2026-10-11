import { describe, expect, it } from "vitest"
import { calculateModelAmount, type RawEntryLine } from "@/lib/fiscal/panorama"
import { minoracionArt110, resolvePriorYearNetIncome } from "@/lib/fiscal/model-130"
import { buildOfficialModelSections } from "@/lib/fiscal/official-layouts"
import { generateAeatTxt, buildAeatTxtFilename } from "@/lib/fiscal/aeat/generate-aeat-txt"
import { validateAeatSubmission } from "@/lib/fiscal/aeat/validate-submission"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

function line(
  partial: Partial<RawEntryLine> & Pick<RawEntryLine, "concepto" | "debe" | "haber" | "cuenta">,
): RawEntryLine {
  return {
    id: partial.id ?? "line-1",
    entryId: partial.entryId ?? "entry-1",
    cuenta: partial.cuenta,
    concepto: partial.concepto,
    debe: partial.debe,
    haber: partial.haber,
    entry: partial.entry ?? { id: "entry-1", fecha: new Date("2026-08-15T12:00:00.000Z"), concepto: null },
  }
}

describe("modelo 130", () => {
  it("aplica la escala del art. 110.3.c", () => {
    expect(minoracionArt110(0)).toBe(100)
    expect(minoracionArt110(9000)).toBe(100)
    expect(minoracionArt110(9000.01)).toBe(75)
    expect(minoracionArt110(10000)).toBe(75)
    expect(minoracionArt110(11000)).toBe(50)
    expect(minoracionArt110(12000)).toBe(25)
    expect(minoracionArt110(12000.01)).toBe(0)
    expect(minoracionArt110(null)).toBe(0)
  })

  it("trata como cero el rendimiento anterior si el alta es del propio ejercicio", () => {
    expect(
      resolvePriorYearNetIncome({
        declarationYear: 2026,
        activityStartDate: "2026-03-01",
        priorYearNetFromBooks: 20000,
      }).net,
    ).toBe(0)
    expect(
      resolvePriorYearNetIncome({
        declarationYear: 2026,
        activityStartDate: null,
        priorYearNetFromBooks: 0,
      }).net,
    ).toBeNull()
  })

  it("resta 100 € en la casilla 13 cuando el alta es de este ejercicio", () => {
    const lines: RawEntryLine[] = [
      line({
        id: "venta",
        concepto: "Nuestra factura N. 1",
        cuenta: "7050001",
        debe: 0,
        haber: 1000,
      }),
      line({
        id: "gasto",
        concepto: "Su factura N. 2",
        cuenta: "6290001",
        debe: 200,
        haber: 0,
        entry: { id: "e-gasto", fecha: new Date("2026-08-20T12:00:00.000Z"), concepto: "34" },
      }),
    ]

    const result = calculateModelAmount("130", lines, 2026, 3, {
      model130: { activityStartDate: "2026-02-01", priorYearNetFromBooks: null },
    })
    expect(result.amount).toBe(60)
    expect(result.breakdown.find((item) => item.key === "minoracion")?.total).toBe(100)
    expect(result.breakdown.find((item) => item.key === "resultado")?.total).toBe(60)
  })

  it("arrastra el pago previo por la casilla 07 y el exceso de minoración", () => {
    const lines: RawEntryLine[] = [
      line({
        id: "venta",
        concepto: "Nuestra factura N. 1",
        cuenta: "7050001",
        debe: 0,
        haber: 1000,
        entry: { id: "e1", fecha: new Date("2026-02-10T12:00:00.000Z"), concepto: "17" },
      }),
      line({
        id: "venta-2",
        concepto: "Nuestra factura N. 2",
        cuenta: "7050001",
        debe: 0,
        haber: 1000,
        entry: { id: "e2", fecha: new Date("2026-08-10T12:00:00.000Z"), concepto: "17" },
      }),
    ]
    const options = { model130: { activityStartDate: "2026-01-15", priorYearNetFromBooks: null } }
    expect(calculateModelAmount("130", lines, 2026, 1, options).amount).toBe(100)
    const second = calculateModelAmount("130", lines, 2026, 2, options)
    expect(second.amount).toBe(0)
    expect(second.breakdown.find((item) => item.key === "resultado")?.total).toBe(-100)
    const third = calculateModelAmount("130", lines, 2026, 3, options)
    expect(third.breakdown.find((item) => item.key === "resultados-negativos")?.total).toBe(100)
    expect(third.amount).toBe(0)
  })
})

describe("fichero AEAT modelo 130", () => {
  it("genera el diseño DR130 con la casilla 13 y la extensión .130", () => {
    const detail = {
      modelCode: "130",
      modelLabel: "Modelo 130",
      year: 2026,
      quarter: 1,
      periodLabel: "1T 2026",
      amount: 60,
      status: "pendiente",
      statusLabel: "Pendiente",
      breakdown: [
        { key: "ingresos", label: "Ingresos", total: 1000, lines: [] },
        { key: "gastos", label: "Gastos", total: 200, lines: [] },
        { key: "rendimiento", label: "Rendimiento", total: 800, lines: [] },
        { key: "cuota", label: "Cuota", total: 160, lines: [] },
        { key: "pagos-previos", label: "Previos", total: 0, lines: [] },
        { key: "retenciones-soportadas", label: "Retenciones", total: 0, lines: [] },
        { key: "pago-fraccionado", label: "Pago", total: 160, lines: [] },
        { key: "minoracion", label: "Minoración", total: 100, lines: [] },
        { key: "diferencia", label: "Diferencia", total: 60, lines: [] },
        { key: "resultados-negativos", label: "Negativos", total: 0, lines: [] },
        { key: "resultado", label: "Resultado", total: 60, lines: [] },
      ],
    } as FiscalModelDetailResponse

    const sections = buildOfficialModelSections(detail)
    expect(sections.flatMap((section) => section.casillas).find((cell) => cell.code === "13")?.amount).toBe(100)
    expect(sections.flatMap((section) => section.casillas).find((cell) => cell.code === "05")?.amount).toBe(0)
    expect(sections.flatMap((section) => section.casillas).find((cell) => cell.code === "06")?.amount).toBe(0)

    const buffer = generateAeatTxt(detail, "GARCIA LOPEZ, ANA", "12345678Z")
    const content = buffer.toString("latin1")
    expect(content.startsWith("<T130020261T0000>")).toBe(true)
    expect(content).toContain("<AUX>")
    expect(content).toContain("</T13001000>")
    expect(buildAeatTxtFilename(detail, "12345678Z")).toBe("12345678Z20261T.130")

    const pageStart = content.indexOf("<T13001000>")
    const page = content.slice(pageStart, pageStart + 600)
    expect(page).toHaveLength(600)
    expect(page.slice(142, 159)).toBe("00000000000080000")
    expect(page.slice(210, 227)).toBe("00000000000016000")
    expect(page.slice(312, 329)).toBe("00000000000010000")
    expect(page.slice(414, 431)).toBe("00000000000006000")
    expect(page.slice(142, 431)).toMatch(/^[0-9]+$/)

    const validation = validateAeatSubmission(detail, "GARCIA LOPEZ, ANA", "12345678Z")
    expect(validation.valid).toBe(true)
    expect(validation.issues.filter((issue) => issue.severity === "error")).toHaveLength(0)
  })

  it("escribe el resultado negativo con signo menos", () => {
    const detail = {
      modelCode: "130",
      modelLabel: "Modelo 130",
      year: 2026,
      quarter: 2,
      periodLabel: "2T 2026",
      amount: 0,
      status: "pendiente",
      statusLabel: "Pendiente",
      breakdown: [
        { key: "ingresos", label: "Ingresos", total: 1000, lines: [] },
        { key: "gastos", label: "Gastos", total: 0, lines: [] },
        { key: "rendimiento", label: "Rendimiento", total: 1000, lines: [] },
        { key: "cuota", label: "Cuota", total: 200, lines: [] },
        { key: "pagos-previos", label: "Previos", total: 200, lines: [] },
        { key: "retenciones-soportadas", label: "Retenciones", total: 0, lines: [] },
        { key: "pago-fraccionado", label: "Pago", total: 0, lines: [] },
        { key: "minoracion", label: "Minoración", total: 100, lines: [] },
        { key: "diferencia", label: "Diferencia", total: -100, lines: [] },
        { key: "resultados-negativos", label: "Negativos", total: 0, lines: [] },
        { key: "resultado", label: "Resultado", total: -100, lines: [] },
      ],
    } as FiscalModelDetailResponse

    const content = generateAeatTxt(detail, "GARCIA LOPEZ, ANA", "12345678Z").toString("latin1")
    const page = content.slice(content.indexOf("<T13001000>"), content.indexOf("<T13001000>") + 600)
    expect(page.slice(329, 346)).toBe("-0000000000010000")
    expect(page.slice(414, 431)).toBe("-0000000000010000")
    expect(page[12]).toBe("B")
  })
})

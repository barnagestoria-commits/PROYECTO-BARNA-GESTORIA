import { describe, expect, it } from "vitest"
import { aggregateMovementFacts } from "@/lib/reports/movement-facts"
import {
  buildStatementLayout,
  changePercent,
  mergeColumnRows,
  pruneOptionalColumns,
} from "@/lib/reports/statement-layout"

describe("variación de la comparativa", () => {
  it("calcula el porcentaje contra el ejercicio anterior y deja la base a cero sin porcentaje", () => {
    expect(changePercent(10000, 8000)).toBe(25)
    expect(changePercent(8000, 10000)).toBe(-20)
    expect(changePercent(0, 0)).toBe(0)
    expect(changePercent(1500, 0)).toBeNull()
  })

  it("pone cada ejercicio comparado y su porcentaje junto al ejercicio actual", () => {
    const layout = buildStatementLayout({
      kind: "balance",
      year: 2026,
      compareYears: [2024, 2025, 2026],
      breakdown: "anual",
      fromMonth: 1,
      toMonth: 12,
      costCenterListing: "consolidado",
    })

    expect(layout.columns.map((column) => column.label)).toEqual(["2026", "% vs 2025", "2025", "% vs 2024", "2024"])
    expect(layout.columns[1]).toMatchObject({ kind: "percent", currentIndex: 0, baseIndex: 2 })
    expect(layout.columns[3]).toMatchObject({ kind: "percent", currentIndex: 0, baseIndex: 4 })
    expect(layout.slices.map((slice) => [slice.year, slice.fromMonth, slice.toMonth])).toEqual([
      [2026, 1, 12],
      [2025, 1, 12],
      [2024, 1, 12],
    ])
  })

  it("acumula el balance hasta el cierre de cada trimestre y empareja un ejercicio comparado", () => {
    const layout = buildStatementLayout({
      kind: "balance",
      year: 2026,
      compareYears: [2025],
      breakdown: "trimestral",
      fromMonth: 1,
      toMonth: 12,
      costCenterListing: "consolidado",
    })

    expect(layout.columns.map((column) => column.label)).toEqual([
      "1T 2026",
      "1T 2025",
      "% 1T",
      "2T 2026",
      "2T 2025",
      "% 2T",
      "3T 2026",
      "3T 2025",
      "% 3T",
      "4T 2026",
      "4T 2025",
      "% 4T",
    ])
    expect(layout.slices.find((slice) => slice.id === "2026-2T")).toMatchObject({ fromMonth: 1, toMonth: 6 })
    expect(layout.slices.find((slice) => slice.id === "2025-2T")).toMatchObject({ fromMonth: 1, toMonth: 6 })
  })

  it("suma los trimestres de la cuenta de resultados y calcula el porcentaje del total", () => {
    const layout = buildStatementLayout({
      kind: "pyg",
      year: 2026,
      compareYears: [2025],
      breakdown: "trimestral",
      fromMonth: 1,
      toMonth: 6,
      costCenterListing: "consolidado",
    })
    const total = layout.columns.find((column) => column.id === "sum-2026")
    expect(total).toMatchObject({ kind: "sum", sourceIndexes: [0, 3] })
    expect(layout.slices.find((slice) => slice.id === "2026-2T")).toMatchObject({ fromMonth: 4, toMonth: 6 })

    const merged = mergeColumnRows(layout.columns, new Map([
      ["2026-1T", [{ cuenta: "700", label: "Ventas", level: 0, amount: 100 }]],
      ["2025-1T", [{ cuenta: "700", label: "Ventas", level: 0, amount: 80 }]],
      ["2026-2T", [{ cuenta: "700", label: "Ventas", level: 0, amount: 50 }]],
      ["2025-2T", [{ cuenta: "700", label: "Ventas", level: 0, amount: 40 }]],
    ]))
    expect(merged.rows[0]?.values[layout.columns.findIndex((column) => column.id === "sum-2026")]).toBe(150)
    expect(merged.rows[0]?.values[layout.columns.findIndex((column) => column.label === "% 1T")]).toBe(25)
    expect(merged.totals[layout.columns.findIndex((column) => column.label === "% vs 2025")]).toBe(25)
  })

  it("lista los centros con el total y el porcentaje del ejercicio comparado", () => {
    const layout = buildStatementLayout({
      kind: "pyg",
      year: 2026,
      compareYears: [2025],
      breakdown: "mensual",
      fromMonth: 1,
      toMonth: 12,
      costCenterListing: "por-centros",
      costCenters: [
        { id: "rub", code: "1", name: "Centro Rub" },
        { id: "sab", code: "2", name: "Centro Sab" },
      ],
    })

    expect(layout.columns.map((column) => column.label)).toEqual([
      "1 Centro Rub",
      "2 Centro Sab",
      "Sin centro",
      "Total 2026",
      "% vs 2025",
      "2025",
    ])
    expect(layout.breakdown ?? layout.periodLabel).toContain("por centros")
  })

  it("quita la columna sin centro cuando no hay importe sin repartir", () => {
    const columns = [
      { id: "a", label: "Centro", kind: "amount" as const },
      { id: "b", label: "Sin centro", kind: "amount" as const, optional: true },
      { id: "c", label: "Total", kind: "amount" as const },
    ]
    const pruned = pruneOptionalColumns(columns, [
      {
        rows: [{ values: [10, 0, 10] }],
        totals: [10, 0, 10],
      },
    ])
    expect(pruned.columns.map((column) => column.label)).toEqual(["Centro", "Total"])
    expect(pruned.groups[0]?.rows[0]?.values).toEqual([10, 10])
  })

  it("reparte una línea entre el centro y el resto sin centro", () => {
    const facts = [
      {
        cuenta: "640",
        year: 2026,
        month: 3,
        debe: 100,
        haber: 0,
        distributions: [{ costCenterId: "rub", amount: 60 }],
      },
    ]
    const center = aggregateMovementFacts(facts, {
      id: "rub",
      year: 2026,
      fromMonth: 1,
      toMonth: 12,
      costCenterId: "rub",
    })
    const rest = aggregateMovementFacts(facts, {
      id: "sin",
      year: 2026,
      fromMonth: 1,
      toMonth: 12,
      unassignedOnly: true,
    })
    expect(center.get("640")?.totalDebe).toBe(60)
    expect(rest.get("640")?.totalDebe).toBe(40)
  })
})

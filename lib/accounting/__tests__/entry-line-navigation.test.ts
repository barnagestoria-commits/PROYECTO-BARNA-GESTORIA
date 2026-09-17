import { describe, expect, it } from "vitest"
import { createEmptyLine } from "@/lib/accounting/command-templates"
import {
  buildBalancingCounterpartLine,
  createContinuedEntryLine,
  getNextNavigableField,
  shouldCreateBalancingLineBelow,
  type EntryNavigationContext,
} from "@/lib/accounting/entry-line-navigation"

function manualContext(lines: EntryNavigationContext["lines"]): EntryNavigationContext {
  return {
    activeCommand: null,
    invoiceMode: "recibida",
    invoiceDetails: null,
    lines,
  }
}

describe("buildBalancingCounterpartLine", () => {
  it("creates a credit line below when the entry has more debe", () => {
    const lines = [{ ...createEmptyLine(), cuenta: "642.0001", concepto: "Cuota TGSS", debe: 79.7, haber: 0 }]
    const draft = buildBalancingCounterpartLine(lines)

    expect(draft?.line.debe).toBe(0)
    expect(draft?.line.haber).toBe(79.7)
    expect(draft?.line.cuenta).toBe("")
    expect(draft?.focusField).toBe("cuenta")
  })

  it("moves a same-line counterpart account onto the new line", () => {
    const lines = [{ ...createEmptyLine(), cuenta: "642.0001", debe: 79.7, haber: 0, contrapartida: "430.0001" }]
    const draft = buildBalancingCounterpartLine(lines, {
      counterpartAccount: "430.0001",
      concepto: "Cuota TGSS",
    })

    expect(draft?.line.cuenta).toBe("430.0001")
    expect(draft?.line.concepto).toBe("Cuota TGSS")
    expect(draft?.line.haber).toBe(79.7)
    expect(draft?.focusField).toBe("haber")
  })

  it("creates a debit line when the entry has more haber", () => {
    const lines = [{ ...createEmptyLine(), cuenta: "700", debe: 0, haber: 100 }]
    const draft = buildBalancingCounterpartLine(lines)

    expect(draft?.line.debe).toBe(100)
    expect(draft?.line.haber).toBe(0)
  })

  it("does not add a line when the entry already balances", () => {
    const lines = [
      { ...createEmptyLine(), cuenta: "642.0001", debe: 79.7, haber: 0 },
      { ...createEmptyLine(), cuenta: "430.0001", debe: 0, haber: 79.7 },
    ]
    expect(buildBalancingCounterpartLine(lines)).toBeNull()
  })

  it("copies the previous document number onto the new line", () => {
    const lines = [
      { ...createEmptyLine(), cuenta: "642.0001", documento: "01", concepto: "Cuota TGSS", debe: 79.7, haber: 0 },
    ]
    const draft = buildBalancingCounterpartLine(lines)

    expect(draft?.line.documento).toBe("01")
    expect(draft?.line.concepto).toBe("")
    expect(draft?.line.id).not.toBe(lines[0].id)
  })

  it("uses the fallback document when the previous line has none stored", () => {
    const lines = [{ ...createEmptyLine(), cuenta: "410.0001", debe: 0, haber: 121 }]
    const draft = buildBalancingCounterpartLine(lines, { documento: "FV-12" })

    expect(draft?.line.documento).toBe("FV-12")
  })
})

describe("createContinuedEntryLine", () => {
  it("keeps the previous document on an empty continuation line", () => {
    const previous = { ...createEmptyLine(), documento: "01", concepto: "Cuota TGSS", cuenta: "642.0001" }
    const next = createContinuedEntryLine(previous)

    expect(next.documento).toBe("01")
    expect(next.concepto).toBe("")
    expect(next.cuenta).toBe("")
    expect(next.id).not.toBe(previous.id)
  })
})

describe("shouldCreateBalancingLineBelow", () => {
  it("offers a line below from the counterpart cell of the last unbalanced row", () => {
    const lines = [{ ...createEmptyLine(), cuenta: "642.0001", debe: 79.7, haber: 0 }]
    expect(shouldCreateBalancingLineBelow(0, "contrapartida", manualContext(lines))).toBe(true)
  })

  it("keeps Enter on the amount going to the same-line counterpart", () => {
    const lines = [{ ...createEmptyLine(), cuenta: "642.0001", debe: 79.7, haber: 0 }]
    expect(getNextNavigableField(0, "debe", manualContext(lines))).toEqual({
      row: 0,
      field: "contrapartida",
    })
    expect(shouldCreateBalancingLineBelow(0, "debe", manualContext(lines))).toBe(false)
  })

  it("does not insert a line when another row already follows", () => {
    const lines = [
      { ...createEmptyLine(), cuenta: "642.0001", debe: 79.7, haber: 0 },
      { ...createEmptyLine(), cuenta: "430.0001", debe: 0, haber: 0 },
    ]
    expect(shouldCreateBalancingLineBelow(0, "contrapartida", manualContext(lines))).toBe(false)
  })
})

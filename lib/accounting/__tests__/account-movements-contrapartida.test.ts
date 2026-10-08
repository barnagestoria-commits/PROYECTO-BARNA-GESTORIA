import { describe, expect, it } from "vitest"
import {
  formatContrapartida,
  resolveMovementDocumentNumber,
} from "@/lib/accounting/account-movements-service"

describe("formatContrapartida", () => {
  it("lists every distinct counterpart account, not only the first", () => {
    expect(
      formatContrapartida(
        [
          { cuenta: "410.0003" },
          { cuenta: "472" },
          { cuenta: "628.0001" },
        ],
        "4100003",
      ),
    ).toBe("472.0000 · 628.0001")
  })

  it("does not repeat the same counterpart twice", () => {
    expect(
      formatContrapartida(
        [
          { cuenta: "410.0003" },
          { cuenta: "472" },
          { cuenta: "472" },
        ],
        "410.0003",
      ),
    ).toBe("472.0000")
  })

  it("returns null when there is no counterpart", () => {
    expect(formatContrapartida([{ cuenta: "410.0003" }], "4100003")).toBeNull()
  })
})

describe("resolveMovementDocumentNumber", () => {
  it("uses the stored invoice number on income lines that omit it from the concept", () => {
    expect(
      resolveMovementDocumentNumber({
        invoiceNumber: "FV-2026-14",
        commandCode: "17",
        concepts: ["Ventas a RETAIL-SERVICER-SPAIN-SL", "Nuestra factura N. FV-2026-14"],
      }),
    ).toBe("FV-2026-14")
  })

  it("reads the number from invoice details when the column is empty", () => {
    expect(
      resolveMovementDocumentNumber({
        invoiceNumber: null,
        invoiceDataJson: JSON.stringify({ invoiceNumber: "FT 48391" }),
        commandCode: "34",
        concepts: ["Gasto a PROVEEDOR-SL"],
      }),
    ).toBe("FT 48391")
  })

  it("falls back to the counterpart concept when the current line has no number", () => {
    expect(
      resolveMovementDocumentNumber({
        invoiceNumber: "  ",
        commandCode: "17",
        concepts: ["Ventas a RETAIL-SERVICER-SPAIN-SL", "Nuestra factura N. 24"],
      }),
    ).toBe("24")
  })

  it("shows an imported document stored outside the accounting command codes", () => {
    expect(
      resolveMovementDocumentNumber({
        invoiceNumber: null,
        commandCode: "FRA001",
        concepts: ["Ventas a CLIENTE"],
      }),
    ).toBe("FRA001")
  })

  it("does not treat command 17 or 34 as a document number", () => {
    expect(
      resolveMovementDocumentNumber({
        invoiceNumber: null,
        commandCode: "17",
        concepts: ["Ventas a CLIENTE"],
      }),
    ).toBeNull()
  })
})

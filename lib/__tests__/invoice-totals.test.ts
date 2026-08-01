import { describe, expect, it } from "vitest"
import {
  calculateCuotaIva,
  calculateTotalFromBreakdown,
  sumDesglose,
  totalsMatchBreakdown,
  syncInvoiceTotals,
} from "@/lib/invoice-totals"
import type { InvoiceOcrResult } from "@/lib/types/invoice"

describe("invoice-totals", () => {
  it("calcula cuota IVA al 21%", () => {
    expect(calculateCuotaIva(100, 21)).toBe(21)
    expect(calculateCuotaIva(100, 10)).toBe(10)
    expect(calculateCuotaIva(100, 4)).toBe(4)
  })

  it("suma desglose de IVA", () => {
    const result = sumDesglose([
      { base_imponible: 100, tipo_iva: 21, cuota_iva: 21 },
      { base_imponible: 50, tipo_iva: 10, cuota_iva: 5 },
    ])

    expect(result.baseImponible).toBe(150)
    expect(result.iva).toBe(26)
  })

  it("calcula total con recargo de equivalencia", () => {
    const total = calculateTotalFromBreakdown(
      [{ base_imponible: 100, tipo_iva: 21, cuota_iva: 21 }],
      { tipo: 5.2, cuota: 5.2 },
    )
    expect(total).toBe(126.2)
  })

  it("valida coherencia entre total y desglose", () => {
    const invoice: InvoiceOcrResult = {
      proveedor: "Proveedor SL",
      cif: "B12345678",
      numeroFactura: "F001",
      fechaFactura: "2025-01-15",
      baseImponible: 100,
      iva: 21,
      total: 121,
      iva_desglose: [{ base_imponible: 100, tipo_iva: 21, cuota_iva: 21 }],
      recargo_equivalencia: null,
      isSujetoPasivo: false,
      isIntracomunitaria: false,
    }

    expect(totalsMatchBreakdown(invoice)).toBe(true)
  })

  it("syncInvoiceTotals recalcula totales desde el desglose", () => {
    const synced = syncInvoiceTotals({
      proveedor: "Proveedor SL",
      cif: "B12345678",
      numeroFactura: "F002",
      fechaFactura: "2025-01-15",
      baseImponible: 0,
      iva: 0,
      total: 0,
      iva_desglose: [{ base_imponible: 200, tipo_iva: 21, cuota_iva: 42 }],
      recargo_equivalencia: null,
      isSujetoPasivo: false,
      isIntracomunitaria: false,
    })

    expect(synced.baseImponible).toBe(200)
    expect(synced.iva).toBe(42)
    expect(synced.total).toBe(242)
  })
})

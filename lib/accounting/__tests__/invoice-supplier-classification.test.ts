import { describe, expect, it } from "vitest"
import {
  classifyReceivedInvoicePurchase,
  parsePurchaseNature,
  withPurchaseClassification,
} from "@/lib/accounting/invoice-supplier-classification"
import type { InvoiceOcrResult } from "@/lib/types/invoice"

function invoice(overrides: Partial<InvoiceOcrResult> = {}): InvoiceOcrResult {
  return {
    proveedor: "Proveedor SL",
    cif: "B12345678",
    numeroFactura: "F001",
    fechaFactura: "2026-08-15",
    iva_desglose: [{ base_imponible: 6.61, tipo_iva: 21, cuota_iva: 1.39 }],
    recargo_equivalencia: null,
    baseImponible: 6.61,
    iva: 1.39,
    total: 8,
    isIntracomunitaria: false,
    isSujetoPasivo: false,
    ...overrides,
  }
}

describe("invoice-supplier-classification", () => {
  it("clasifica una gasolinera como 410 + 628", () => {
    const result = classifyReceivedInvoicePurchase({
      proveedor: "ESTACION SERVICIO MATARO S.L.",
      numeroFactura: "FT 48282",
      fileName: "MELANY 3T TICKETS Y MANTENIMIENTO MOTO.pdf",
      activities: [{ epigraph: "722", description: "Repartidor de paquetes" }],
      entityType: "PERSONA_FISICA",
    })

    expect(result.accountPrefix).toBe("410")
    expect(result.expenseAccount).toBe("628")
    expect(result.nature).toBe("suministros")
  })

  it("clasifica recambios de moto como 410 + 622", () => {
    const result = classifyReceivedInvoicePurchase({
      proveedor: "REDD PARTS S.L.U",
      numeroFactura: "PDVHCR086909",
      activities: [{ epigraph: "722", description: "reparto de paquetes" }],
    })

    expect(result.accountPrefix).toBe("410")
    expect(result.expenseAccount).toBe("622")
    expect(result.nature).toBe("reparaciones")
  })

  it("usa 400 + 600 solo cuando hay mercaderías", () => {
    const result = classifyReceivedInvoicePurchase({
      proveedor: "MAKRO MAYORISTA SL",
      naturalezaCompra: "mercaderias",
      activities: [{ epigraph: "647", description: "Comercio al por menor" }],
    })

    expect(result.accountPrefix).toBe("400")
    expect(result.expenseAccount).toBe("600")
  })

  it("un autónomo de servicios no convierte un mayorista en 400 si el OCR no lo marca como mercaderías", () => {
    const result = classifyReceivedInvoicePurchase({
      proveedor: "MAKRO MAYORISTA SL",
      activities: [{ epigraph: "722", description: "Repartidor de paquetes" }],
      entityType: "PERSONA_FISICA",
    })

    expect(result.accountPrefix).toBe("410")
  })

  it("un autónomo sin coincidencia concreta cae en 410 + 629", () => {
    const result = classifyReceivedInvoicePurchase({
      proveedor: "ACME SERVICIOS SL",
      entityType: "PERSONA_FISICA",
      activities: [{ epigraph: "849.9", description: "Mensajería" }],
    })

    expect(result.accountPrefix).toBe("410")
    expect(result.expenseAccount).toBe("629")
  })

  it("respeta la cuenta que ya viene confirmada por el usuario", () => {
    const classified = withPurchaseClassification(
      invoice({
        proveedor: "ESTACION SERVICIO MATARO S.L.",
        accountPrefix: "400",
        expenseAccount: "600",
        classificationReason: "Corregido a mano",
      }),
      { activities: [{ description: "reparto" }] },
    )

    expect(classified.accountPrefix).toBe("400")
    expect(classified.expenseAccount).toBe("600")
    expect(classified.classificationReason).toBe("Corregido a mano")
  })

  it("parsea la naturaleza del OCR", () => {
    expect(parsePurchaseNature("Suministros")).toBe("suministros")
    expect(parsePurchaseNature("reparaciones")).toBe("reparaciones")
    expect(parsePurchaseNature("mercaderías")).toBe("mercaderias")
  })
})

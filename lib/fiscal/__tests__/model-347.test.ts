import { describe, expect, it } from "vitest"
import { buildModel347Declarados } from "@/lib/fiscal/model-347/aggregate"
import {
  buildModel347Filename,
  generateModel347AeatTxt,
  model347FileIssues,
} from "@/lib/fiscal/model-347/generate-file"
import { model347BreakdownLines } from "@/lib/fiscal/model-347/aggregate"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import { validateAeatSubmission } from "@/lib/fiscal/aeat/validate-submission"

function invoice(nif: string, name: string, base: number, quota: number, taxForm = "347", operation = "1") {
  return JSON.stringify({
    invoiceNumber: "1",
    issueDate: "2026-02-01",
    operationDate: "2026-02-01",
    thirdPartyName: name,
    nif,
    isRectificativa: false,
    vatLines: [{ id: "v", operation, base, vatType: "04", vatPercent: 21, quota, taxForm }],
    applyIrpf: false,
    irpfPercent: 0,
    irpfAccount: "",
  })
}

describe("modelo 347", () => {
  const parties = [
    { accountCode: "43000001", cif: "B12345674", name: "Cliente Norte SL", postalCode: "08001" },
    { accountCode: "40000001", cif: "A84919760", name: "Proveedor Sur SL", postalCode: "28001" },
  ]

  it("agrupa las facturas con IVA y deja fuera lo que no supera el umbral ni lo intracomunitario", () => {
    const declarados = buildModel347Declarados({
      year: 2026,
      parties,
      entries: [
        {
          id: "e1",
          fecha: "2026-02-10",
          commandCode: "17",
          invoiceDataJson: invoice("B12345674", "Cliente Norte SL", 2000, 420),
          lines: [{ cuenta: "43000001", concepto: "Cliente", debe: 2420, haber: 0 }],
        },
        {
          id: "e2",
          fecha: "2026-05-10",
          commandCode: "17",
          invoiceDataJson: invoice("B12345674", "Cliente Norte SL", 2000, 420),
          lines: [{ cuenta: "43000001", concepto: "Cliente", debe: 2420, haber: 0 }],
        },
        {
          id: "e3",
          fecha: "2026-03-01",
          commandCode: "34",
          invoiceDataJson: invoice("A84919760", "Proveedor Sur SL", 100, 21),
          lines: [],
        },
        {
          id: "e4",
          fecha: "2026-04-01",
          commandCode: "34",
          invoiceDataJson: invoice("IE6388047V", "Europa Ltd", 8000, 0, "349", "3"),
          lines: [],
        },
      ],
    })

    expect(declarados).toHaveLength(1)
    expect(declarados[0]).toMatchObject({
      nif: "B12345674",
      clave: "B",
      province: "08",
      annual: 4840,
      blockedReason: null,
    })
    expect(declarados[0]?.quarters).toEqual([2420, 2420, 0, 0])
  })

  it("genera el fichero de 500 posiciones que pide Hacienda", () => {
    const declarados = buildModel347Declarados({
      year: 2026,
      parties,
      entries: [
        {
          id: "e1",
          fecha: "2026-02-10",
          commandCode: "17",
          invoiceDataJson: invoice("B12345674", "Cliente Norte SL", 4000, 840),
          lines: [],
        },
      ],
    })
    const detail: FiscalModelDetailResponse = {
      modelCode: "347",
      modelLabel: "Modelo 347",
      year: 2026,
      quarter: "annual",
      periodLabel: "Ejercicio 2026",
      amount: 4840,
      status: "pendiente",
      statusLabel: "Pendiente",
      breakdown: [
        {
          key: "operaciones-terceros",
          label: "Operaciones",
          total: 4840,
          lines: model347BreakdownLines(declarados, 2026),
        },
      ],
    }

    expect(model347FileIssues(detail, "Barna Gestoria SL", "B67330225")).toEqual([])
    const content = generateModel347AeatTxt(detail, "Barna Gestoría SL", "B67330225").toString("latin1")
    const records = content.split("\r\n")
    expect(records).toHaveLength(2)
    expect(records.every((record) => record.length === 500)).toBe(true)
    expect(records[0]?.slice(0, 8)).toBe("13472026")
    expect(records[0]?.slice(8, 17)).toBe("B67330225")
    expect(records[0]?.slice(57, 58)).toBe("T")
    expect(records[0]?.slice(135, 144)).toBe("000000001")
    expect(records[0]?.slice(145, 160)).toBe("000000000484000")
    expect(records[1]?.slice(0, 4)).toBe("2347")
    expect(records[1]?.slice(17, 26)).toBe("B12345674")
    expect(records[1]?.slice(75, 76)).toBe("D")
    expect(records[1]?.slice(76, 78)).toBe("08")
    expect(records[1]?.slice(81, 82)).toBe("B")
    expect(records[1]?.slice(83, 98)).toBe("000000000484000")
    expect(records[1]?.slice(136, 151)).toBe("000000000484000")
    expect(records[1]?.slice(299, 305)).toBe("000000")
    expect(buildModel347Filename(2026, "B67330225")).toBe("3472026_B67330225.347")
    expect(validateAeatSubmission(detail, "Barna Gestoria SL", "B67330225").valid).toBe(true)
  })

  it("ignora la factura si el impreso no es el 347", () => {
    const declarados = buildModel347Declarados({
      year: 2026,
      parties,
      entries: [
        {
          id: "e1",
          fecha: "2026-02-10",
          commandCode: "17",
          invoiceDataJson: invoice("B12345674", "Cliente Norte SL", 4000, 840, "111"),
          lines: [{ cuenta: "70000000", concepto: "Ventas", debe: 0, haber: 4000 }],
        },
      ],
    })
    expect(declarados).toHaveLength(0)
  })

  it("no deja descargar un declarado sin provincia", () => {
    const declarados = buildModel347Declarados({
      year: 2026,
      parties: [],
      entries: [
        {
          id: "e1",
          fecha: "2026-02-10",
          commandCode: "17",
          invoiceDataJson: invoice("B12345674", "Cliente Norte SL", 4000, 840),
          lines: [],
        },
      ],
    })
    expect(declarados[0]?.blockedReason).toMatch(/código postal/)
  })

  it("no deja descargar un NIF que Hacienda rechazaría", () => {
    const declarados = buildModel347Declarados({
      year: 2026,
      parties: [{ accountCode: "43000009", cif: "B12345678", name: "Cliente Malo SL", postalCode: "08001" }],
      entries: [
        {
          id: "e1",
          fecha: "2026-02-10",
          commandCode: "17",
          invoiceDataJson: invoice("B12345678", "Cliente Malo SL", 4000, 840),
          lines: [],
        },
      ],
    })
    expect(declarados[0]?.blockedReason).toMatch(/no es válido/)
  })
})

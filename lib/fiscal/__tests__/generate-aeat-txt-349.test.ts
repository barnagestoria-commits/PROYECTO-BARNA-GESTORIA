import { describe, expect, it } from "vitest"
import { MODEL_349_RECORD_LENGTH } from "@/lib/fiscal/model-349/generate-file"
import { buildAeatTxtFilename, generateAeatTxt } from "@/lib/fiscal/aeat/generate-aeat-txt"
import { validateAeatSubmission } from "@/lib/fiscal/aeat/validate-submission"
import { calculateModelAmount, type RawEntryLine } from "@/lib/fiscal/panorama"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

const VALID_NIF = "B12345674"

function detail349(): FiscalModelDetailResponse {
  return {
    modelCode: "349",
    modelLabel: "Modelo 349",
    year: 2026,
    quarter: 1,
    periodLabel: "1T 2026",
    amount: 43000,
    status: "pendiente",
    statusLabel: "Pendiente",
    breakdown: [
      {
        key: "intracomunitarias",
        label: "Operaciones intracomunitarias",
        total: 43000,
        lines: [
          {
            entryId: "e1",
            entryDate: "2026-01-15",
            lineId: "sales",
            cuenta: "700000000000",
            concepto: "Venta intracomunitaria",
            debe: 0,
            haber: 25000,
            signedAmount: 25000,
            category: "contributing",
            model349SourceLineId: "l1",
          },
          {
            entryId: "e1",
            entryDate: "2026-01-15",
            lineId: "l1",
            cuenta: "477000000000",
            concepto: "IVA R./CLIENTE FR PT123456789",
            debe: 0,
            haber: 0,
            signedAmount: 0,
            category: "asiento",
          },
          {
            entryId: "e2",
            entryDate: "2026-02-10",
            lineId: "purchase",
            cuenta: "600000000000",
            concepto: "Servicios cloud",
            debe: 18000,
            haber: 0,
            signedAmount: 18000,
            category: "contributing",
            model349SourceLineId: "l2",
          },
          {
            entryId: "e2",
            entryDate: "2026-02-10",
            lineId: "l2",
            cuenta: "472000000000",
            concepto: "IVA S./GOOGLE IRELAND IE6388047V",
            debe: 3780,
            haber: 0,
            signedAmount: 0,
            category: "asiento",
          },
        ],
      },
    ],
  }
}

describe("fichero modelo 349", () => {
  it("genera declarante y un registro por operador y clave", () => {
    const detail = detail349()
    const content = generateAeatTxt(detail, "EMPRESA TEST S.L.", VALID_NIF).toString("latin1")
    const records = content.split("\r\n")

    expect(records).toHaveLength(3)
    expect(records.every((record) => record.length === MODEL_349_RECORD_LENGTH)).toBe(true)
    expect(content.includes("\n9")).toBe(false)
    expect(records[0].startsWith("13492026")).toBe(true)
    expect(records[0].slice(8, 17)).toBe(VALID_NIF)
    expect(records[0].slice(17, 32)).toBe("EMPRESA TEST SL")
    expect(records[0].slice(107, 120)).toBe("3492026000000")
    expect(records[0].slice(135, 137)).toBe("1T")
    expect(records[0].slice(137, 146)).toBe("000000002")
    expect(records[0].slice(146, 161)).toBe("000000004300000")

    expect(records[1].startsWith("2349")).toBe(true)
    expect(records[1].slice(75, 77)).toBe("PT")
    expect(records[1].slice(77, 86)).toBe("123456789")
    expect(records[1].slice(92, 102)).toBe("CLIENTE FR")
    expect(records[1][132]).toBe("E")
    expect(records[1].slice(133, 146)).toBe("0000002500000")

    expect(records[2].slice(75, 77)).toBe("IE")
    expect(records[2].slice(77, 85)).toBe("6388047V")
    expect(records[2].slice(92, 106)).toBe("GOOGLE IRELAND")
    expect(records[2][132]).toBe("I")
    expect(records[2].slice(133, 146)).toBe("0000001800000")

    expect(buildAeatTxtFilename(detail, VALID_NIF)).toBe("34920261T_B12345674.349")
    expect(validateAeatSubmission(detail, "EMPRESA TEST SL", VALID_NIF).valid).toBe(true)
  })

  it("no deja descargar un operador sin NIF-IVA", () => {
    const detail = detail349()
    detail.breakdown[0].lines = [
      {
        entryId: "e1",
        entryDate: "2026-01-15",
        lineId: "sales",
        cuenta: "700000000000",
        concepto: "IVA R./CLIENTE UE",
        debe: 0,
        haber: 25000,
        signedAmount: 25000,
        category: "contributing",
      },
    ]
    const validation = validateAeatSubmission(detail, "EMPRESA TEST SL", VALID_NIF)
    expect(validation.valid).toBe(false)
    expect(validation.issues.some((issue) => issue.code === "OPERATOR_VAT")).toBe(true)
  })

  it("recoge una factura con impreso 349 aunque el concepto no diga intracomunitaria", () => {
    const entry = {
      id: "e-factura",
      fecha: new Date("2026-03-02T12:00:00.000Z"),
      concepto: "34",
      invoiceDataJson: JSON.stringify({
        nif: "IE6388047V",
        thirdPartyName: "Google Ireland",
        vatLines: [{ taxForm: "349", operation: "7", base: 1000 }],
      }),
    }
    const lines: RawEntryLine[] = [
      {
        id: "gasto",
        entryId: entry.id,
        cuenta: "629000000000",
        concepto: "Gasto a GOOGLE-IRELAND",
        debe: 1000,
        haber: 0,
        entry,
      },
      {
        id: "proveedor",
        entryId: entry.id,
        cuenta: "400000000000",
        concepto: "Su factura N. 9",
        debe: 0,
        haber: 1000,
        entry,
      },
    ]

    const result = calculateModelAmount("349", lines, 2026, 1)
    expect(result.amount).toBe(1000)
    const contributing = result.breakdown[0].lines.find((line) => line.category === "contributing")
    expect(contributing?.nif).toBe("IE6388047V")
    expect(contributing?.nombre).toBe("Google Ireland")
  })
})

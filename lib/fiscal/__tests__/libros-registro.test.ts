import { describe, expect, it } from "vitest"
import { expenseConceptFromAccount, incomeConceptFromAccount, resolveActivityCodes } from "@/lib/fiscal/aeat/libros-registro/codes"
import { buildLibrosRegistroFilename } from "@/lib/fiscal/aeat/libros-registro/filename"
import { generateLibrosRegistroXlsx } from "@/lib/fiscal/aeat/libros-registro/generate-lsi-xlsx"
import {
  formatAeatDate,
  isWithinLibrosRange,
  mapEntriesToLibrosRegistro,
  shouldOfferLibrosRegistro,
} from "@/lib/fiscal/aeat/libros-registro/map-libros"
import { parseLibrosRegistroXlsx } from "@/lib/fiscal/aeat/libros-registro/parse-lsi-xlsx"
import type { LibrosRegistroContext, LibrosRegistroEntryInput } from "@/lib/fiscal/aeat/libros-registro/types"
import type { InvoiceEntryDetails } from "@/lib/types/invoice-entry-details"

const autonomaContext: LibrosRegistroContext = {
  year: 2026,
  throughQuarter: 2,
  companyName: "Arteaga Tumbaco",
  companyCif: "39506184G",
  entityType: "PERSONA_FISICA",
  includeIrpf: true,
  activities: [{ epigraph: "722", description: "Reparto de paquetes", isMain: true }],
  parties: [{ accountCode: "4300001", cif: "B12345678", name: "Cliente Demo SL" }],
}

function issuedInvoice(): LibrosRegistroEntryInput {
  return {
    id: "e-issued",
    fecha: "2026-04-15",
    issueDate: "2026-04-15",
    operationDate: "2026-04-15",
    invoiceNumber: "F-2026-100",
    commandCode: "17",
    invoiceDetails: {
      invoiceNumber: "F-2026-100",
      issueDate: "2026-04-15",
      operationDate: "2026-04-15",
      thirdPartyName: "Cliente Demo SL",
      nif: "B12345678",
      isRectificativa: false,
      vatLines: [
        {
          id: "v1",
          operation: "1",
          base: 100,
          vatType: "04",
          vatPercent: 21,
          quota: 21,
          taxForm: "347",
        },
      ],
      applyIrpf: false,
      irpfPercent: 0,
      irpfAccount: "",
    } satisfies InvoiceEntryDetails,
    lines: [
      { cuenta: "4300001", concepto: "Cliente Demo SL", debe: 121, haber: 0 },
      { cuenta: "7050001", concepto: "Servicios", debe: 0, haber: 100 },
      { cuenta: "4770000", concepto: "IVA", debe: 0, haber: 21 },
    ],
  }
}

function receivedInvoice(): LibrosRegistroEntryInput {
  return {
    id: "e-received",
    fecha: "2026-05-02",
    issueDate: "2026-05-01",
    operationDate: "2026-05-01",
    invoiceNumber: "FT 48391",
    commandCode: "34",
    invoiceDetails: {
      invoiceNumber: "FT 48391",
      issueDate: "2026-05-01",
      operationDate: "2026-05-01",
      thirdPartyName: "Digi Spain Telecom SL",
      nif: "B86020514",
      isRectificativa: false,
      vatLines: [
        {
          id: "v2",
          operation: "1",
          base: 12.43,
          vatType: "04",
          vatPercent: 21,
          quota: 2.61,
          taxForm: "347",
        },
      ],
      applyIrpf: false,
      irpfPercent: 0,
      irpfAccount: "",
    } satisfies InvoiceEntryDetails,
    lines: [
      { cuenta: "6280001", concepto: "Suministros", debe: 12.43, haber: 0 },
      { cuenta: "4720000", concepto: "IVA", debe: 2.61, haber: 0 },
      { cuenta: "4100001", concepto: "Digi", debe: 0, haber: 15.04 },
    ],
  }
}

describe("libros registro AEAT", () => {
  it("offers the Hacienda Excel for models 130 and 303", () => {
    expect(shouldOfferLibrosRegistro("130", 2)).toBe(true)
    expect(shouldOfferLibrosRegistro("303", 1)).toBe(true)
    expect(shouldOfferLibrosRegistro("111", 1)).toBe(false)
    expect(shouldOfferLibrosRegistro("303", "annual")).toBe(false)
  })

  it("builds the official AEAT filename", () => {
    expect(
      buildLibrosRegistroFilename({
        year: 2026,
        companyCif: "39506184G",
        companyName: "Arteaga Tumbaco",
      }),
    ).toBe("202639506184GTarteaga tumbaco.xlsx")
  })

  it("maps issued and received invoices to the official columns", () => {
    const books = mapEntriesToLibrosRegistro([issuedInvoice(), receivedInvoice()], autonomaContext)
    expect(books.issued).toHaveLength(1)
    expect(books.received).toHaveLength(1)

    const issued = books.issued[0]!
    expect(issued.periodo).toBe("2T")
    expect(issued.tipoFactura).toBe("F1")
    expect(issued.conceptoIngreso).toBe("I01")
    expect(issued.ingresoComputable).toBe(100)
    expect(issued.claveOperacion).toBe("01")
    expect(issued.calificacion).toBe("S1")
    expect(issued.baseImponible).toBe(100)
    expect(issued.cuotaIva).toBe(21)
    expect(issued.nifIdentificacion).toBe("B12345678")
    expect(issued.actividadTipo).toBe("05")
    expect(issued.epigrafe).toBe("722")

    const received = books.received[0]!
    expect(received.conceptoGasto).toBe("GY4")
    expect(received.gastoDeducible).toBe(12.43)
    expect(received.fechaRecepcion).toBe("02/05/2026")
    expect(received.cuotaDeducible).toBe(2.61)
    expect(received.bienInversion).toBe("N")
  })

  it("keeps first-quarter invoices when exporting the second quarter", () => {
    const q1: LibrosRegistroEntryInput = {
      ...issuedInvoice(),
      id: "e-q1",
      fecha: "2026-02-10",
      issueDate: "2026-02-10",
      operationDate: "2026-02-10",
      invoiceDetails: {
        ...issuedInvoice().invoiceDetails!,
        issueDate: "2026-02-10",
        operationDate: "2026-02-10",
      },
    }
    const books = mapEntriesToLibrosRegistro([q1, issuedInvoice()], autonomaContext)
    expect(books.issued.map((row) => row.periodo)).toEqual(["1T", "2T"])
  })

  it("excludes later quarters from a 2T book", () => {
    const source = issuedInvoice()
    const q3: LibrosRegistroEntryInput = {
      ...source,
      id: "e-q3",
      fecha: "2026-08-01",
      issueDate: "2026-08-01",
      operationDate: "2026-08-01",
      invoiceDetails: source.invoiceDetails
        ? { ...source.invoiceDetails, issueDate: "2026-08-01", operationDate: "2026-08-01" }
        : null,
    }
    const books = mapEntriesToLibrosRegistro([q3], autonomaContext)
    expect(books.issued).toHaveLength(0)
  })

  it("omits IRPF columns for a company", () => {
    const books = mapEntriesToLibrosRegistro([issuedInvoice()], {
      ...autonomaContext,
      entityType: "PERSONA_JURIDICA",
      includeIrpf: false,
    })
    expect(books.issued[0]?.conceptoIngreso).toBe("")
    expect(books.issued[0]?.ingresoComputable).toBe("")
    expect(books.issued[0]?.claveOperacion).toBe("01")
  })

  it("exports a bank fee without invoice as an IRPF SF row", () => {
    const books = mapEntriesToLibrosRegistro(
      [
        {
          id: "e-bank",
          fecha: "2026-03-03",
          commandCode: null,
          lines: [
            { cuenta: "6260000", concepto: "Comisión banco", debe: 8, haber: 0 },
            { cuenta: "5720000", concepto: "Banco", debe: 0, haber: 8 },
          ],
        },
      ],
      autonomaContext,
    )
    expect(books.received).toHaveLength(1)
    expect(books.received[0]?.tipoFactura).toBe("SF")
    expect(books.received[0]?.conceptoGasto).toBe("G20")
    expect(books.received[0]?.gastoDeducible).toBe(8)
  })

  it("skips tax liquidation entries", () => {
    const books = mapEntriesToLibrosRegistro(
      [
        {
          id: "e-130",
          fecha: "2026-04-20",
          commandCode: "130",
          lines: [{ cuenta: "4730000", concepto: "Pago 130", debe: 300, haber: 0 }],
        },
      ],
      autonomaContext,
    )
    expect(books.issued).toHaveLength(0)
    expect(books.received).toHaveLength(0)
  })

  it("writes the official sheet names and round-trips the rows", async () => {
    const books = mapEntriesToLibrosRegistro([issuedInvoice(), receivedInvoice()], autonomaContext)
    const buffer = await generateLibrosRegistroXlsx({
      year: 2026,
      companyName: "Arteaga Tumbaco",
      companyCif: "39506184G",
      books,
    })
    const parsed = await parseLibrosRegistroXlsx(buffer)
    expect(parsed.sheetNames).toEqual(["EXPEDIDAS_INGRESOS", "RECIBIDAS_GASTOS", "BIENES-INVERSIÓN"])
    expect(parsed.books.issued).toHaveLength(1)
    expect(parsed.books.received).toHaveLength(1)
    expect(parsed.books.issued[0]?.numero).toBe("100")
    expect(parsed.books.received[0]?.serieNumero).toContain("48391")
  })

  it("maps PGC accounts to AEAT income and expense concepts", () => {
    expect(incomeConceptFromAccount("705.0001")).toBe("I01")
    expect(incomeConceptFromAccount("760")).toBe("I02")
    expect(expenseConceptFromAccount("628.0001")).toBe("GY4")
    expect(expenseConceptFromAccount("6210001")).toBe("G12")
    expect(resolveActivityCodes([{ epigraph: "647", description: "Comercio al por menor" }])).toMatchObject({
      codigo: "A",
      tipo: "03",
      epigrafe: "647",
    })
  })

  it("formats AEAT dates and the YTD range", () => {
    expect(formatAeatDate("2026-04-15")).toBe("15/04/2026")
    expect(isWithinLibrosRange("2026-06-30", 2026, 2)).toBe(true)
    expect(isWithinLibrosRange("2026-07-01", 2026, 2)).toBe(false)
  })
})

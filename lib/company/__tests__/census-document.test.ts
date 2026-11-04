import { describe, expect, it } from "vitest"
import { contrastCensus, parseCensusDocumentText } from "@/lib/company/census-document"

const CERTIFICATE = `
CERTIFICADO DE SITUACIÓN CENSAL
Agencia Tributaria
NIF: B67330225
RAZÓN SOCIAL: EMPRESA TEST SL
ACTIVIDADES ECONÓMICAS
Epígrafe IAE 845. Servicios de programación. CNAE-2025 6201. Fecha de alta 01/03/2018.
OBLIGACIONES TRIBUTARIAS
Impuesto sobre Sociedades. Modelo 200. Anual.
Pago fraccionado del Impuesto sobre Sociedades. Modelo 202.
Impuesto sobre el Valor Añadido. Régimen general. Modelo 303.
Inscrito en el Suministro Inmediato de Información con carácter voluntario.
`

describe("lectura del censo", () => {
  it("lee el certificado de una sociedad y contrasta el CNAE distinto", () => {
    const reading = parseCensusDocumentText(CERTIFICATE)
    expect(reading.kind).toBe("CERTIFICADO_CENSAL")
    expect(reading.nif).toBe("B67330225")
    expect(reading.cnae).toBe("6201")
    expect(reading.corporateTaxCharacter).toBe("SOCIEDAD")
    expect(reading.siiMode).toBe("VOLUNTARIO")

    const contrast = contrastCensus(
      {
        cif: "B67330225",
        cnae: "4110",
        corporateTaxCharacter: "SOCIEDAD",
        siiMode: "NONE",
        cashBasisSubject: false,
      },
      reading,
    )
    expect(contrast.nifMatches).toBe(true)
    expect(contrast.suggestion).toEqual({ cnae: "6201", siiMode: "VOLUNTARIO" })
  })

  it("no copia datos si el NIF del documento es de otra empresa", () => {
    const reading = parseCensusDocumentText(CERTIFICATE)
    const contrast = contrastCensus(
      {
        cif: "B12345674",
        cnae: null,
        corporateTaxCharacter: "SOCIEDAD",
        siiMode: "NONE",
        cashBasisSubject: false,
      },
      reading,
    )
    expect(contrast.nifMatches).toBe(false)
    expect(contrast.suggestion).toBeNull()
    expect(contrast.rows.find((row) => row.field === "nif")?.status).toBe("differ")
  })

  it("toma el alta del 036 y no el mero enunciado del impuesto", () => {
    const filed = parseCensusDocumentText(`
      Modelo 036. Declaración censal de alta, modificación y baja.
      NIF B12345674. Nombre EMPRESA PRESENTADA SL.
      Actividad principal CNAE 6920.
      Impuesto sobre Sociedades Alta en el censo de empresarios.
      El formulario también menciona el Impuesto sobre la Renta como apartado general del censo.
    `)
    expect(filed.kind).toBe("M036")
    expect(filed.corporateTaxCharacter).toBe("SOCIEDAD")
    expect(filed.cnae).toBe("6920")

    const blank = parseCensusDocumentText(`
      Modelo 036. Declaración censal de alta, modificación y baja en el censo de empresarios.
      NIF B12345674. Los apartados impresos citan el       Impuesto sobre Sociedades y el IVA
      sin marcar ninguna obligación. CNAE 6920.
    `)
    expect(blank.corporateTaxCharacter).toBeNull()
  })

  it("marca entidad de crédito y deja el 037 fuera del impuesto sobre sociedades", () => {
    const bank = parseCensusDocumentText(`
      Certificado de situación censal. NIF A84919760.
      Forma jurídica: entidad de crédito. CNAE 6419.
      Impuesto sobre Sociedades. Modelo 200.
    `)
    expect(bank.corporateTaxCharacter).toBe("ENTIDAD_CREDITO")

    const freelance = parseCensusDocumentText(`
      Modelo 037. Declaración censal simplificada. Persona física.
      NIF 12345678Z. Actividad profesional CNAE 6920. Fecha de alta 02/01/2024.
    `)
    expect(freelance.kind).toBe("M037")
    expect(freelance.nif).toBe("12345678Z")
    expect(freelance.corporateTaxCharacter).toBe("NO_SUJETA")
  })

  it("rechaza un PDF que no es censo o que no trae texto", () => {
    expect(() =>
      parseCensusDocumentText(
        "Factura número 2026-14 de servicios de gestoría emitida a un cliente con NIF B67330225 y base imponible detallada en la página siguiente del documento.",
      ),
    ).toThrow(/036/)
    expect(() => parseCensusDocumentText("Modelo 036")).toThrow(/no trae texto/)
  })
})

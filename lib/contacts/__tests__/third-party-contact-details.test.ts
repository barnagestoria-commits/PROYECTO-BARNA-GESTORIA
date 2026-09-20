import { describe, expect, it } from "vitest"
import { mapThirdPartiesToContacts } from "@/lib/contacts/third-party-contacts"

describe("third party contact details", () => {
  it("keeps CIF and address on the contact mapped from a third party", () => {
    const contacts = mapThirdPartiesToContacts([
      {
        id: "tp-1",
        type: "PROVEEDOR",
        cif: "B63272603",
        name: "ZINCO BUSINESS SOLUTIONS S.L",
        accountCode: "4000007",
        formattedAccountCode: "400.0007",
        email: "admin@zinco.es",
        phone: "934000000",
        address: "Carrer de Rocafort 1",
        postalCode: "08015",
        city: "Barcelona",
      },
    ])

    expect(contacts).toHaveLength(1)
    expect(contacts[0]).toMatchObject({
      nif: "B63272603",
      razonSocial: "ZINCO BUSINESS SOLUTIONS S.L",
      direccionFiscal: "Carrer de Rocafort 1",
      codigoPostal: "08015",
      ciudad: "Barcelona",
      email: "admin@zinco.es",
      telefono: "934000000",
    })
  })
})

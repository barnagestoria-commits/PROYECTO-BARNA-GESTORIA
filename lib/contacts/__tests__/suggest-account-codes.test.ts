import { describe, expect, it } from "vitest"
import { MOCK_CONTACTS } from "@/lib/contacts/demo-contacts"
import { suggestAccountCodes } from "@/lib/contacts/mock-contacts"
import type { Contact } from "@/lib/contacts/types"

describe("suggestAccountCodes", () => {
  it("ignores demo contacts when suggesting the next account", () => {
    const realContact: Contact = {
      id: "real-1",
      razonSocial: "Cliente Real SL",
      nif: "B12345678",
      tipo: "cliente",
      cuentaCliente: "4300001",
      email: "",
      telefono: "",
      direccionFiscal: "",
      codigoPostal: "",
      ciudad: "",
      formaPago: "transferencia",
      saldoPendiente: 0,
    }

    const suggested = suggestAccountCodes("cliente", [...MOCK_CONTACTS, realContact])
    expect(suggested.cuentaCliente).toBe("4300002")
  })

  it("starts at 4300001 when only demo contacts exist in the UI list", () => {
    const suggested = suggestAccountCodes("cliente", MOCK_CONTACTS)
    expect(suggested.cuentaCliente).toBe("4300001")
  })
})

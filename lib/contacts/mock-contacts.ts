import {
  isDemoContact,
  MOCK_CONTACTS,
  withoutDemoContacts,
} from "@/lib/contacts/demo-contacts"
import {
  buildAccountCode,
  parseSubaccountSequence,
} from "@/lib/accounting/third-party-types"
import type { Contact, ContactTabFilter, ContactType, NewContactFormData } from "@/lib/contacts/types"

export { MOCK_CONTACTS }

export const PAYMENT_METHOD_LABELS: Record<Contact["formaPago"], string> = {
  transferencia: "Transferencia",
  domiciliacion: "Domiciliación",
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  pagare: "Pagaré",
}

function nextAccountSequence(contacts: Contact[], prefix: "430" | "400"): number {
  const realContacts = withoutDemoContacts(contacts)
  let max = 0

  for (const contact of realContacts) {
    const codes = [contact.cuentaCliente, contact.cuentaProveedor].filter(Boolean) as string[]
    for (const code of codes) {
      const sequence = parseSubaccountSequence(code, prefix)
      if (sequence !== null) max = Math.max(max, sequence)
    }
  }

  return max + 1
}

export function suggestAccountCodes(
  tipo: ContactType,
  contacts: Contact[],
): { cuentaCliente: string; cuentaProveedor: string } {
  const clienteSequence = nextAccountSequence(contacts, "430")
  const proveedorSequence = nextAccountSequence(contacts, "400")

  if (tipo === "cliente") {
    return {
      cuentaCliente: buildAccountCode("430", clienteSequence),
      cuentaProveedor: "",
    }
  }
  if (tipo === "proveedor") {
    return {
      cuentaCliente: "",
      cuentaProveedor: buildAccountCode("400", proveedorSequence),
    }
  }
  return {
    cuentaCliente: buildAccountCode("430", clienteSequence),
    cuentaProveedor: buildAccountCode("400", proveedorSequence),
  }
}

export function createEmptyContactForm(contacts: Contact[]): NewContactFormData {
  const accounts = suggestAccountCodes("cliente", contacts)
  return {
    razonSocial: "",
    nif: "",
    tipo: "cliente",
    cuentaCliente: accounts.cuentaCliente,
    cuentaProveedor: accounts.cuentaProveedor,
    email: "",
    telefono: "",
    direccionFiscal: "",
    codigoPostal: "",
    ciudad: "",
    iban: "",
    formaPago: "transferencia",
  }
}

export function contactFromForm(data: NewContactFormData, id: string): Contact {
  return {
    id,
    razonSocial: data.razonSocial.trim(),
    nif: data.nif.trim().toUpperCase(),
    tipo: data.tipo,
    cuentaCliente: data.cuentaCliente || undefined,
    cuentaProveedor: data.cuentaProveedor || undefined,
    email: data.email.trim(),
    telefono: data.telefono.trim(),
    direccionFiscal: data.direccionFiscal.trim(),
    codigoPostal: data.codigoPostal.trim(),
    ciudad: data.ciudad.trim(),
    iban: data.iban.trim() || undefined,
    formaPago: data.formaPago,
    saldoPendiente: 0,
  }
}

export function filterContactsByTab(contacts: Contact[], tab: ContactTabFilter): Contact[] {
  if (tab === "clientes") {
    return contacts.filter((c) => c.tipo === "cliente" || c.tipo === "ambos")
  }
  if (tab === "proveedores") {
    return contacts.filter((c) => c.tipo === "proveedor" || c.tipo === "ambos")
  }
  return contacts
}

export function searchContacts(contacts: Contact[], query: string): Contact[] {
  const q = query.trim().toLowerCase()
  if (!q) return contacts
  return contacts.filter(
    (c) =>
      c.razonSocial.toLowerCase().includes(q) ||
      c.nif.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q),
  )
}

export function isRealContact(contact: Contact): boolean {
  return !isDemoContact(contact)
}

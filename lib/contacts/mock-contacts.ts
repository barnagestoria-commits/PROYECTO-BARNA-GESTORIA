import type { Contact, ContactTabFilter, ContactType, NewContactFormData } from "@/lib/contacts/types"

export const MOCK_CONTACTS: Contact[] = [
  {
    id: "1",
    razonSocial: "Tech Solutions SL",
    nif: "B12345678",
    tipo: "cliente",
    cuentaCliente: "430000001",
    email: "facturacion@techsolutions.es",
    telefono: "+34 932 111 222",
    direccionFiscal: "C/ Balmes 120, 08008 Barcelona",
    iban: "ES91 2100 0418 4502 0005 1332",
    formaPago: "transferencia",
    saldoPendiente: 3150,
  },
  {
    id: "2",
    razonSocial: "Suministros García SA",
    nif: "A08123456",
    tipo: "proveedor",
    cuentaProveedor: "400000001",
    email: "administracion@sumgarcia.com",
    telefono: "+34 934 555 010",
    direccionFiscal: "Pol. Ind. Nord, 08100 Mollet del Vallès",
    iban: "ES80 0049 0001 5025 1014 5678",
    formaPago: "domiciliacion",
    saldoPendiente: -890,
  },
  {
    id: "3",
    razonSocial: "Innovación BC SL",
    nif: "B66554433",
    tipo: "cliente",
    cuentaCliente: "430000002",
    email: "hola@innovacionbc.com",
    telefono: "+34 600 123 456",
    direccionFiscal: "Av. Diagonal 500, 08006 Barcelona",
    formaPago: "transferencia",
    saldoPendiente: 7800,
  },
  {
    id: "4",
    razonSocial: "Logística Express SL",
    nif: "B99887766",
    tipo: "proveedor",
    cuentaProveedor: "400000002",
    email: "contabilidad@logexpress.es",
    telefono: "+34 931 444 888",
    direccionFiscal: "C/ Logística 8, 08940 Cornellà",
    formaPago: "pagare",
    saldoPendiente: -1650,
  },
  {
    id: "5",
    razonSocial: "Distribuciones Norte SL",
    nif: "B11223344",
    tipo: "ambos",
    cuentaCliente: "430000003",
    cuentaProveedor: "400000003",
    email: "info@distnorte.es",
    telefono: "+34 972 300 111",
    direccionFiscal: "C/ Comercio 45, 17001 Girona",
    iban: "ES12 0081 0001 2300 0123 4567",
    formaPago: "transferencia",
    saldoPendiente: 420,
  },
  {
    id: "6",
    razonSocial: "Consultoría Martínez",
    nif: "52678901K",
    tipo: "proveedor",
    cuentaProveedor: "400000004",
    email: "martinez@consultoria.cat",
    telefono: "+34 933 222 999",
    direccionFiscal: "Pl. Catalunya 1, 08002 Barcelona",
    formaPago: "transferencia",
    saldoPendiente: 0,
  },
  {
    id: "7",
    razonSocial: "Startup Labs SL",
    nif: "B55443322",
    tipo: "cliente",
    cuentaCliente: "430000004",
    email: "finance@startuplabs.io",
    telefono: "+34 644 555 777",
    direccionFiscal: "C/ Poblenou 22@, 08005 Barcelona",
    formaPago: "tarjeta",
    saldoPendiente: 6500,
  },
  {
    id: "8",
    razonSocial: "Servicios Cloud Inc.",
    nif: "W1234567A",
    tipo: "proveedor",
    cuentaProveedor: "400000005",
    email: "billing@cloudservices.com",
    telefono: "+1 415 555 0100",
    direccionFiscal: "Remote — UE VAT OSS",
    formaPago: "tarjeta",
    saldoPendiente: -129,
  },
]

export const PAYMENT_METHOD_LABELS: Record<Contact["formaPago"], string> = {
  transferencia: "Transferencia",
  domiciliacion: "Domiciliación",
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  pagare: "Pagaré",
}

function nextAccountSuffix(contacts: Contact[], prefix: "430" | "400"): string {
  const pattern = new RegExp(`^${prefix}000(\\d{3})$`)
  let max = 0
  for (const contact of contacts) {
    const codes = [contact.cuentaCliente, contact.cuentaProveedor].filter(Boolean) as string[]
    for (const code of codes) {
      const match = code.match(pattern)
      if (match) max = Math.max(max, parseInt(match[1], 10))
    }
  }
  return String(max + 1).padStart(3, "0")
}

export function suggestAccountCodes(
  tipo: ContactType,
  contacts: Contact[],
): { cuentaCliente: string; cuentaProveedor: string } {
  const clienteSuffix = nextAccountSuffix(contacts, "430")
  const proveedorSuffix = nextAccountSuffix(contacts, "400")

  if (tipo === "cliente") {
    return { cuentaCliente: `430000${clienteSuffix}`, cuentaProveedor: "" }
  }
  if (tipo === "proveedor") {
    return { cuentaCliente: "", cuentaProveedor: `400000${proveedorSuffix}` }
  }
  return {
    cuentaCliente: `430000${clienteSuffix}`,
    cuentaProveedor: `400000${proveedorSuffix}`,
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

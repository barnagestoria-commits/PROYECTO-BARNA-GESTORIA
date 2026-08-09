import type { Contact } from "@/lib/contacts/types"

/** NIFs de contactos de demostración (no deben ocupar numeración real). */
export const DEMO_CONTACT_NIFS = new Set([
  "B00000018",
  "A00000026",
  "B00000034",
  "B00000042",
  "B00000059",
  "52678901T",
  "B00000067",
  "B00000075",
])

export const MOCK_CONTACTS: Contact[] = [
  {
    id: "demo-1",
    razonSocial: "Tech Solutions SL",
    nif: "B00000018",
    tipo: "cliente",
    cuentaCliente: "430000001",
    email: "facturacion@techsolutions.es",
    telefono: "+34 932 111 222",
    direccionFiscal: "C/ Balmes 120",
    codigoPostal: "08008",
    ciudad: "Barcelona",
    iban: "ES91 2100 0418 4502 0005 1332",
    formaPago: "transferencia",
    saldoPendiente: 3150,
  },
  {
    id: "demo-2",
    razonSocial: "Suministros García SA",
    nif: "A00000026",
    tipo: "proveedor",
    cuentaProveedor: "400000001",
    email: "administracion@sumgarcia.com",
    telefono: "+34 934 555 010",
    direccionFiscal: "Pol. Ind. Nord, Carrer de l'Estany 12",
    codigoPostal: "08100",
    ciudad: "Mollet del Vallès",
    iban: "ES80 0049 0001 5025 1014 5678",
    formaPago: "domiciliacion",
    saldoPendiente: -890,
  },
  {
    id: "demo-3",
    razonSocial: "Innovación BC SL",
    nif: "B00000034",
    tipo: "cliente",
    cuentaCliente: "430000002",
    email: "hola@innovacionbc.com",
    telefono: "+34 600 123 456",
    direccionFiscal: "Av. Diagonal 500",
    codigoPostal: "08006",
    ciudad: "Barcelona",
    formaPago: "transferencia",
    saldoPendiente: 7800,
  },
  {
    id: "demo-4",
    razonSocial: "Logística Express SL",
    nif: "B00000042",
    tipo: "proveedor",
    cuentaProveedor: "400000002",
    email: "contabilidad@logexpress.es",
    telefono: "+34 931 444 888",
    direccionFiscal: "C/ Logística 8",
    codigoPostal: "08940",
    ciudad: "Cornellà de Llobregat",
    formaPago: "pagare",
    saldoPendiente: -1650,
  },
  {
    id: "demo-5",
    razonSocial: "Distribuciones Norte SL",
    nif: "B00000059",
    tipo: "ambos",
    cuentaCliente: "430000003",
    cuentaProveedor: "400000003",
    email: "info@distnorte.es",
    telefono: "+34 972 300 111",
    direccionFiscal: "C/ Comercio 45",
    codigoPostal: "17001",
    ciudad: "Girona",
    iban: "ES12 0081 0001 2300 0123 4567",
    formaPago: "transferencia",
    saldoPendiente: 420,
  },
  {
    id: "demo-6",
    razonSocial: "Consultoría Martínez",
    nif: "52678901T",
    tipo: "proveedor",
    cuentaProveedor: "400000004",
    email: "martinez@consultoria.cat",
    telefono: "+34 933 222 999",
    direccionFiscal: "Plaça de Catalunya 1, 3º 2ª",
    codigoPostal: "08002",
    ciudad: "Barcelona",
    formaPago: "transferencia",
    saldoPendiente: 0,
  },
  {
    id: "demo-7",
    razonSocial: "Startup Labs SL",
    nif: "B00000067",
    tipo: "cliente",
    cuentaCliente: "430000004",
    email: "finance@startuplabs.io",
    telefono: "+34 644 555 777",
    direccionFiscal: "C/ Poblenou 22@, Edificio Beta",
    codigoPostal: "08005",
    ciudad: "Barcelona",
    formaPago: "tarjeta",
    saldoPendiente: 6500,
  },
  {
    id: "demo-8",
    razonSocial: "Servicios Cloud Inc.",
    nif: "B00000075",
    tipo: "proveedor",
    cuentaProveedor: "400000005",
    email: "billing@cloudservices.com",
    telefono: "+1 415 555 0100",
    direccionFiscal: "Paseo de la Castellana 95",
    codigoPostal: "28046",
    ciudad: "Madrid",
    formaPago: "tarjeta",
    saldoPendiente: -129,
  },
]

export function isDemoNif(nif: string): boolean {
  const normalized = nif.replace(/[^A-Z0-9]/gi, "").toUpperCase()
  return DEMO_CONTACT_NIFS.has(normalized)
}

export function isDemoContact(contact: Contact): boolean {
  return contact.id.startsWith("demo-") || isDemoNif(contact.nif)
}

/** Formato antiguo de cuentas demo en pantalla (430000001). No usar en numeración real. */
export function isDemoStyleAccountCode(accountCode: string): boolean {
  const digits = accountCode.replace(/\D/g, "")
  return /^430000\d{3}$/.test(digits) || /^400000\d{3}$/.test(digits)
}

export function withoutDemoContacts(contacts: Contact[]): Contact[] {
  return contacts.filter((contact) => !isDemoContact(contact))
}

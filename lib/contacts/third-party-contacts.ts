import type { ThirdPartyType } from "@prisma/client"
import type { Contact, ContactType } from "@/lib/contacts/types"
import { isDemoThirdParty } from "@/lib/contacts/demo-contacts"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"

export interface ThirdPartyListItem {
  id: string
  type: ThirdPartyType
  cif: string
  name: string
  accountCode: string
  formattedAccountCode: string
  email?: string | null
  phone?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
}

function contactTypeFromThirdParty(type: ThirdPartyType): ContactType {
  return type === "CLIENTE" ? "cliente" : "proveedor"
}

export function mapThirdPartiesToContacts(parties: ThirdPartyListItem[]): Contact[] {
  const byCif = new Map<string, Contact>()

  for (const party of parties) {
    if (isDemoThirdParty(party)) continue

    const existing = byCif.get(party.cif)
    if (!existing) {
      byCif.set(party.cif, {
        id: party.id,
        razonSocial: party.name,
        nif: party.cif,
        tipo: contactTypeFromThirdParty(party.type),
        cuentaCliente: party.type === "CLIENTE" ? party.accountCode : undefined,
        cuentaProveedor: party.type === "PROVEEDOR" ? party.accountCode : undefined,
        email: party.email ?? "",
        telefono: party.phone ?? "",
        direccionFiscal: party.address ?? "",
        codigoPostal: party.postalCode ?? "",
        ciudad: party.city ?? "",
        formaPago: "transferencia",
        saldoPendiente: 0,
      })
      continue
    }

    if (party.type === "CLIENTE") {
      existing.tipo = existing.tipo === "proveedor" ? "ambos" : "cliente"
      existing.cuentaCliente = party.accountCode
    } else {
      existing.tipo = existing.tipo === "cliente" ? "ambos" : "proveedor"
      existing.cuentaProveedor = party.accountCode
    }
    existing.email = existing.email || party.email || ""
    existing.telefono = existing.telefono || party.phone || ""
    existing.direccionFiscal = existing.direccionFiscal || party.address || ""
    existing.codigoPostal = existing.codigoPostal || party.postalCode || ""
    existing.ciudad = existing.ciudad || party.city || ""
  }

  return [...byCif.values()].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial, "es"))
}

export function formatContactAccounts(contact: Contact): string {
  const parts: string[] = []
  if (contact.cuentaCliente) {
    parts.push(formatAccountCodeDisplay(contact.cuentaCliente.replace(/\D/g, "")))
  }
  if (contact.cuentaProveedor) {
    parts.push(formatAccountCodeDisplay(contact.cuentaProveedor.replace(/\D/g, "")))
  }
  return parts.join(" · ") || "—"
}

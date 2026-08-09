import forge from "node-forge"

const SPANISH_TAX_ID =
  /^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J])$/i

export interface ParsedDigitalCertificate {
  holderName: string
  taxId: string
  expiresAt: Date
}

function normalizeTaxId(value: string): string | null {
  const cleaned = value
    .trim()
    .toUpperCase()
    .replace(/^IDCES-/i, "")
    .replace(/^IDCE-/i, "")
    .replace(/[^A-Z0-9]/g, "")

  return SPANISH_TAX_ID.test(cleaned) ? cleaned : null
}

function extractTaxIdFromSubject(
  attributes: Array<{ type?: string; name?: string; value?: string | unknown }>,
): string | null {
  const preferredTypes = new Set([
    "serialNumber",
    "2.5.4.5",
    "x500UniqueIdentifier",
    "UID",
    "0.9.2342.19200300.100.1.1",
  ])

  for (const attribute of attributes) {
    const type = String(attribute.type ?? attribute.name ?? "")
    const rawValue = Array.isArray(attribute.value)
      ? attribute.value.map(String).join("")
      : String(attribute.value ?? "")

    if (!rawValue) continue

    if (preferredTypes.has(type) || /serial/i.test(type)) {
      const taxId = normalizeTaxId(rawValue)
      if (taxId) return taxId
    }

    const embedded = rawValue.match(
      /([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J])/i,
    )
    if (embedded) {
      const taxId = normalizeTaxId(embedded[1])
      if (taxId) return taxId
    }
  }

  return null
}

function extractHolderName(
  attributes: Array<{ type?: string; name?: string; value?: string | unknown }>,
): string | null {
  for (const attribute of attributes) {
    const type = String(attribute.type ?? attribute.name ?? "")
    if (type !== "commonName" && type !== "2.5.4.3" && type !== "CN") continue

    const value = Array.isArray(attribute.value)
      ? attribute.value.map(String).join(" ")
      : String(attribute.value ?? "").trim()

    if (value) return value
  }

  return null
}

export function parsePkcs12Certificate(
  fileBuffer: Buffer,
  password: string,
): ParsedDigitalCertificate {
  let p12: ReturnType<typeof forge.pkcs12.pkcs12FromAsn1>
  try {
    const binary = fileBuffer.toString("binary")
    const asn1 = forge.asn1.fromDer(binary)
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password)
  } catch {
    throw new Error("No se pudo abrir el certificado. Revisa el archivo y la contraseña.")
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const bags = certBags[forge.pki.oids.certBag] ?? []
  const cert = bags[0]?.cert

  if (!cert) {
    throw new Error("El archivo no contiene un certificado válido.")
  }

  const taxId = extractTaxIdFromSubject(cert.subject.attributes as never[])
  if (!taxId) {
    throw new Error("No se pudo extraer el NIF/CIF del certificado.")
  }

  const holderName = extractHolderName(cert.subject.attributes as never[]) ?? taxId
  const expiresAt = cert.validity.notAfter

  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    throw new Error("No se pudo leer la fecha de caducidad del certificado.")
  }

  return { holderName, taxId, expiresAt }
}

export interface CifLookupResult {
  razonSocial: string
  direccionFiscal: string
  codigoPostal: string
  ciudad: string
}

/** Registro mock simulando eInforma / Registro Mercantil */
const MOCK_CIF_REGISTRY: Record<string, CifLookupResult> = {
  B00000018: {
    razonSocial: "Tech Solutions SL",
    direccionFiscal: "C/ Balmes 120",
    codigoPostal: "08008",
    ciudad: "Barcelona",
  },
  A00000026: {
    razonSocial: "Suministros García SA",
    direccionFiscal: "Pol. Ind. Nord, Carrer de l'Estany 12",
    codigoPostal: "08100",
    ciudad: "Mollet del Vallès",
  },
  B00000034: {
    razonSocial: "Innovación BC SL",
    direccionFiscal: "Av. Diagonal 500",
    codigoPostal: "08006",
    ciudad: "Barcelona",
  },
  B00000042: {
    razonSocial: "Logística Express SL",
    direccionFiscal: "C/ Logística 8",
    codigoPostal: "08940",
    ciudad: "Cornellà de Llobregat",
  },
  B00000059: {
    razonSocial: "Distribuciones Norte SL",
    direccionFiscal: "C/ Comercio 45",
    codigoPostal: "17001",
    ciudad: "Girona",
  },
  "52678901T": {
    razonSocial: "Consultoría Martínez",
    direccionFiscal: "Plaça de Catalunya 1, 3º 2ª",
    codigoPostal: "08002",
    ciudad: "Barcelona",
  },
  B00000067: {
    razonSocial: "Startup Labs SL",
    direccionFiscal: "C/ Poblenou 22@, Edificio Beta",
    codigoPostal: "08005",
    ciudad: "Barcelona",
  },
  B00000075: {
    razonSocial: "Servicios Cloud Inc. Sucursal España",
    direccionFiscal: "Paseo de la Castellana 95",
    codigoPostal: "28046",
    ciudad: "Madrid",
  },
  B00000083: {
    razonSocial: "Gestión Integral Barcelona SL",
    direccionFiscal: "Rambla de Catalunya 38",
    codigoPostal: "08007",
    ciudad: "Barcelona",
  },
}

const CIF_LETTERS = "JABCDEFGHI"

export function normalizeTaxId(value: string): string {
  return value.trim().toUpperCase().replace(/[\s.-]/g, "")
}

export function isValidSpanishTaxId(value: string): boolean {
  const id = normalizeTaxId(value)
  if (!id) return false

  if (/^\d{8}[A-Z]$/.test(id)) {
    const number = parseInt(id.slice(0, 8), 10)
    const letter = "TRWAGMYFPDXBNJZSQVHLCKE"[number % 23]
    return id[8] === letter
  }

  if (/^[XYZ]\d{7}[A-Z]$/.test(id)) {
    const prefix = { X: "0", Y: "1", Z: "2" }[id[0] as "X" | "Y" | "Z"]
    const number = parseInt(`${prefix}${id.slice(1, 8)}`, 10)
    const letter = "TRWAGMYFPDXBNJZSQVHLCKE"[number % 23]
    return id[8] === letter
  }

  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(id)) {
    const body = id.slice(1, 8)
    const control = id[8]
    let sum = 0
    for (let i = 0; i < body.length; i++) {
      const digit = parseInt(body[i], 10)
      if (i % 2 === 0) {
        const double = digit * 2
        sum += double > 9 ? Math.floor(double / 10) + (double % 10) : double
      } else {
        sum += digit
      }
    }
    const checkDigit = (10 - (sum % 10)) % 10
    const letterControl = CIF_LETTERS[checkDigit]
    return control === String(checkDigit) || control === letterControl
  }

  return false
}

export function lookupCifByTaxId(taxId: string): CifLookupResult | null {
  const normalized = normalizeTaxId(taxId)
  if (!isValidSpanishTaxId(normalized)) return null
  return MOCK_CIF_REGISTRY[normalized] ?? null
}

import type { InvoiceOcrResult } from "@/lib/types/invoice"

export type PurchaseNature = "mercaderias" | "suministros" | "reparaciones" | "servicios"
export type ReceivedAccountPrefix = "400" | "410"
export type PurchaseExpenseAccount = "600" | "621" | "622" | "623" | "624" | "625" | "628" | "629"
export type PurchaseEntityType = "PERSONA_JURIDICA" | "PERSONA_FISICA"

export interface CompanyActivityHint {
  epigraph?: string
  description?: string
  type?: string
}

export interface ClassifyPurchaseInput {
  proveedor?: string
  numeroFactura?: string
  fileName?: string
  naturalezaCompra?: string | null
  activities?: CompanyActivityHint[]
  entityType?: PurchaseEntityType | null
}

export interface PurchaseClassification {
  nature: PurchaseNature
  accountPrefix: ReceivedAccountPrefix
  expenseAccount: PurchaseExpenseAccount
  reason: string
}

export type SalesIncomeAccount = "700" | "705"

export interface SalesClassification {
  incomeAccount: SalesIncomeAccount
  reason: string
}

export const PURCHASE_EXPENSE_OPTIONS: Array<{
  code: PurchaseExpenseAccount
  label: string
}> = [
  { code: "600", label: "600 · Compras de mercaderías" },
  { code: "621", label: "621 · Arrendamientos y cánones" },
  { code: "622", label: "622 · Reparaciones y conservación" },
  { code: "623", label: "623 · Servicios de profesionales independientes" },
  { code: "624", label: "624 · Transportes" },
  { code: "625", label: "625 · Primas de seguros" },
  { code: "628", label: "628 · Suministros" },
  { code: "629", label: "629 · Otros servicios" },
]

export const SALES_INCOME_OPTIONS: Array<{
  code: SalesIncomeAccount
  label: string
}> = [
  { code: "700", label: "700 · Ventas de mercaderías" },
  { code: "705", label: "705 · Prestaciones de servicios" },
]

const SERVICE_ACTIVITY_PATTERN =
  /repart|mensaj|paquete|transport|mudanz|delivery|rider|moto|ciclomotor|paqueter|logist|profesional|asesor|consultor|peluquer|hosteler|hostal|taxi|mudanza|mudanzas|722|757|849|721|933|973/i

const TRADE_ACTIVITY_PATTERN =
  /comercio|tienda|minorista|mayorista|alimentaci[oó]n|ultramarinos|ferreter|bazar|64[0-9]|65[0-9]|66[0-9]/i

const FUEL_PATTERN =
  /estaci[oó]n\s*(de\s*)?servicio|gasolin|carburante|combustible|gasoil|gazole|diesel|di[eé]sel|cepsa|repsol|petronor|ballenoil|galp|\bbp\b|shell|disa|q8|campsa|bonarea/i

const SUPPLY_PATTERN =
  /iberdrola|endesa|naturgy|aig[uü]es|canal\s+de\s+isabel|suministro|electricidad|\bluz\b|\bgas\b|\bagua\b|fenosa/i

const REPAIR_PATTERN =
  /taller|recambio|recambios|recanvi|\bparts\b|filtro|lubricante|neum[aá]tic|itv|reparac|conservaci[oó]n|junta\s+de\s+tapa|kit\s+rep/i

const PARKING_TOLL_PATTERN =
  /parking|aparcamiento|peaje|saba\b|empark|seitt|abertis|autopista|area\s+de\s+servicio/i

const PROFESSIONAL_PATTERN =
  /notari|abogad|procurador|gestor[ií]a|asesor[ií]a|auditor|ingenier/i

const INSURANCE_PATTERN = /seguro|mutua|mapfre|axa|allianz|zurich|generali|linea\s+directa/i

const RENTAL_PATTERN = /alquiler|arrendamiento|renting|leasing/i

const TRANSPORT_SERVICE_PATTERN = /seur|mrw|correos|gls|dhl|ups|envio|env[ií]o|paqueter/i

const PHONE_PATTERN = /vodafone|movistar|orange|yoigo|m[aá]s\s*m[oó]vil|telefon[ií]a|internet|fibra/i

const MERCHANDISE_PATTERN =
  /mayorista|cash\s*[& ]?carry|makro|almac[eé]n\s+mayor|existencias|mercader[ií]as|materia\s+prima|ferreter[ií]a\s+industrial/i

function normalizeText(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function haystack(input: ClassifyPurchaseInput): string {
  return [input.proveedor, input.numeroFactura, input.fileName].map(normalizeText).join(" ")
}

function activityHaystack(activities: CompanyActivityHint[] = []): string {
  return activities
    .map((activity) => [activity.epigraph, activity.description, activity.type].join(" "))
    .join(" ")
}

export function parsePurchaseNature(value: unknown): PurchaseNature | undefined {
  const normalized = normalizeText(typeof value === "string" ? value : String(value ?? ""))
  if (!normalized) return undefined
  if (/mercader|mercancia|existencias|aprovision/.test(normalized)) return "mercaderias"
  if (/suministr|combust|carbur|gasolin|electric|luz|gas|agua/.test(normalized)) return "suministros"
  if (/reparac|taller|recambio|conserv/.test(normalized)) return "reparaciones"
  if (/servicio/.test(normalized)) return "servicios"
  return undefined
}

function companyDefaults(input: ClassifyPurchaseInput): {
  isServiceCompany: boolean
  isTradeCompany: boolean
} {
  const text = activityHaystack(input.activities)
  const hasServiceActivity = SERVICE_ACTIVITY_PATTERN.test(text)
  const hasTradeActivity = TRADE_ACTIVITY_PATTERN.test(text)
  const isServiceCompany =
    hasServiceActivity || (input.entityType === "PERSONA_FISICA" && !hasTradeActivity)
  const isTradeCompany = hasTradeActivity && !hasServiceActivity

  return { isServiceCompany, isTradeCompany }
}

export function classifyReceivedInvoicePurchase(input: ClassifyPurchaseInput): PurchaseClassification {
  const text = haystack(input)
  const natureFromOcr = parsePurchaseNature(input.naturalezaCompra)
  const { isServiceCompany, isTradeCompany } = companyDefaults(input)

  if (FUEL_PATTERN.test(text)) {
    return {
      nature: "suministros",
      accountPrefix: "410",
      expenseAccount: "628",
      reason: "Ticket de combustible o estación de servicio: acreedor (410) y suministro (628).",
    }
  }

  if (SUPPLY_PATTERN.test(text) || natureFromOcr === "suministros") {
    return {
      nature: "suministros",
      accountPrefix: "410",
      expenseAccount: "628",
      reason: "Suministro (luz, gas, agua o similar): acreedor (410) y 628.",
    }
  }

  if (REPAIR_PATTERN.test(text) || natureFromOcr === "reparaciones") {
    return {
      nature: "reparaciones",
      accountPrefix: "410",
      expenseAccount: "622",
      reason: "Taller o recambios del inmovilizado propio: acreedor (410) y reparaciones (622).",
    }
  }

  if (INSURANCE_PATTERN.test(text)) {
    return {
      nature: "servicios",
      accountPrefix: "410",
      expenseAccount: "625",
      reason: "Prima de seguros: acreedor (410) y 625.",
    }
  }

  if (RENTAL_PATTERN.test(text)) {
    return {
      nature: "servicios",
      accountPrefix: "410",
      expenseAccount: "621",
      reason: "Arrendamiento o renting: acreedor (410) y 621.",
    }
  }

  if (PROFESSIONAL_PATTERN.test(text)) {
    return {
      nature: "servicios",
      accountPrefix: "410",
      expenseAccount: "623",
      reason: "Servicio profesional: acreedor (410) y 623.",
    }
  }

  if (PARKING_TOLL_PATTERN.test(text) || PHONE_PATTERN.test(text) || TRANSPORT_SERVICE_PATTERN.test(text)) {
    return {
      nature: "servicios",
      accountPrefix: "410",
      expenseAccount: "629",
      reason: "Servicio auxiliar (parking, peaje, telefonía o mensajería): acreedor (410) y 629.",
    }
  }

  if (MERCHANDISE_PATTERN.test(text) || natureFromOcr === "mercaderias") {
    if (isServiceCompany && natureFromOcr !== "mercaderias") {
      return {
        nature: "servicios",
        accountPrefix: "410",
        expenseAccount: "629",
        reason: "La actividad del cliente es de servicios: no se trata como compra de mercaderías.",
      }
    }

    return {
      nature: "mercaderias",
      accountPrefix: "400",
      expenseAccount: "600",
      reason: "Compra de existencias o materia prima: proveedor (400) y 600.",
    }
  }

  if (natureFromOcr === "servicios" || isServiceCompany) {
    return {
      nature: "servicios",
      accountPrefix: "410",
      expenseAccount: "629",
      reason: isServiceCompany
        ? "La actividad del cliente (IAE / censo) es de servicios: acreedor (410), no proveedor de mercaderías."
        : "Factura de servicios: acreedor (410) y 629.",
    }
  }

  if (isTradeCompany) {
    return {
      nature: "mercaderias",
      accountPrefix: "400",
      expenseAccount: "600",
      reason: "La actividad del cliente es comercial: proveedor (400) y compras (600).",
    }
  }

  return {
    nature: "servicios",
    accountPrefix: "410",
    expenseAccount: "629",
    reason: "Sin indicios de mercaderías: se crea como acreedor (410) y gasto en 629. Puedes cambiarlo antes de confirmar.",
  }
}

export function classifyIssuedInvoiceIncome(input: ClassifyPurchaseInput): SalesClassification {
  const { isServiceCompany, isTradeCompany } = companyDefaults(input)

  if (isTradeCompany) {
    return {
      incomeAccount: "700",
      reason: "La actividad del cliente es comercial: venta de mercaderías (700) y cliente (430).",
    }
  }

  return {
    incomeAccount: "705",
    reason: isServiceCompany
      ? "La actividad del cliente (IAE / censo) es de servicios: prestación (705) y cliente (430)."
      : "Sin indicios de comercio de mercaderías: prestación de servicios (705) y cliente (430).",
  }
}

export function withIssuedClassification(
  invoice: InvoiceOcrResult,
  context: ClassifyPurchaseInput = {},
): InvoiceOcrResult {
  const classified = classifyIssuedInvoiceIncome({
    proveedor: invoice.proveedor,
    numeroFactura: invoice.numeroFactura,
    fileName: context.fileName,
    activities: context.activities,
    entityType: context.entityType,
  })
  const incomeAccount = invoice.incomeAccount?.trim() || classified.incomeAccount

  return {
    ...invoice,
    accountPrefix: "430",
    incomeAccount,
    classificationReason: invoice.classificationReason ?? classified.reason,
  }
}

export function withPurchaseClassification(
  invoice: InvoiceOcrResult,
  context: ClassifyPurchaseInput = {},
): InvoiceOcrResult {
  const classified = classifyReceivedInvoicePurchase({
    proveedor: invoice.proveedor,
    numeroFactura: invoice.numeroFactura,
    naturalezaCompra: invoice.naturalezaCompra,
    fileName: context.fileName,
    activities: context.activities,
    entityType: context.entityType,
  })

  const prefix =
    invoice.accountPrefix === "400" || invoice.accountPrefix === "410"
      ? invoice.accountPrefix
      : classified.accountPrefix
  const expenseAccount = invoice.expenseAccount?.trim() || classified.expenseAccount

  return {
    ...invoice,
    naturalezaCompra: invoice.naturalezaCompra ?? classified.nature,
    accountPrefix: prefix,
    expenseAccount,
    classificationReason: invoice.classificationReason ?? classified.reason,
  }
}

export function receivedPrefixFromAccountCode(accountCode: string): ReceivedAccountPrefix {
  const digits = accountCode.replace(/\D/g, "")
  return digits.startsWith("410") ? "410" : "400"
}

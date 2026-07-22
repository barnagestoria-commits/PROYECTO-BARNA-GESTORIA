export type AccountingSourceFormat = "a3" | "holded" | "sage" | "generic"

export interface AccountingFormatProfile {
  id: AccountingSourceFormat
  name: string
  vendor: string
  description: string
  extensions: string[]
  /** Separador CSV recomendado al exportar */
  csvDelimiter: ";" | ","
  columnAliases: {
    fecha: string[]
    cuenta: string[]
    concepto: string[]
    debe: string[]
    haber: string[]
    asiento?: string[]
    documento?: string[]
  }
  exportHeaders: string[]
}

export const ACCOUNTING_FORMAT_PROFILES: AccountingFormatProfile[] = [
  {
    id: "a3",
    name: "A3 Asesor / Wolters Kluwer",
    vendor: "A3",
    description:
      "Diario y mayor exportados desde A3 eco/Asesor. Columnas habituales: Fecha, Cuenta, Concepto, Debe, Haber.",
    extensions: [".csv", ".xlsx", ".xls", ".txt"],
    csvDelimiter: ";",
    columnAliases: {
      fecha: ["fecha", "date", "f. operacion", "f operacion"],
      cuenta: ["cuenta", "codigo cuenta", "código cuenta", "account", "nº cuenta"],
      concepto: ["concepto", "descripcion", "descripción", "titulo", "título", "title"],
      debe: ["debe", "debit", "importe debe"],
      haber: ["haber", "credit", "credito", "crédito", "importe haber"],
      asiento: ["asiento", "nº asiento", "num asiento", "entry"],
      documento: ["documento", "doc", "nº documento", "num documento"],
    },
    exportHeaders: ["Fecha", "Asiento", "Cuenta", "Concepto", "Debe", "Haber", "Documento"],
  },
  {
    id: "holded",
    name: "Holded",
    vendor: "Holded",
    description:
      "Libro diario y plan contable de Holded. Exportación estándar con date, account, description, debit, credit.",
    extensions: [".csv", ".xlsx", ".xls"],
    csvDelimiter: ",",
    columnAliases: {
      fecha: ["date", "fecha", "accounting date"],
      cuenta: ["account", "cuenta", "account number", "account code"],
      concepto: ["description", "descripcion", "descripción", "name", "concept"],
      debe: ["debit", "debito", "débito", "debe"],
      haber: ["credit", "credito", "crédito", "haber"],
      asiento: ["entry", "journal", "asiento", "entry number"],
      documento: ["document", "documento", "invoice", "factura"],
    },
    exportHeaders: ["date", "account", "description", "debit", "credit", "entryNumber"],
  },
  {
    id: "sage",
    name: "Sage / ContaPlus",
    vendor: "Sage",
    description: "Asientos exportados desde Sage 50, ContaPlus u otros ERP compatibles PGC.",
    extensions: [".csv", ".xlsx", ".xls", ".txt"],
    csvDelimiter: ";",
    columnAliases: {
      fecha: ["fecha", "f.contable", "f contable", "date"],
      cuenta: ["cuenta", "cod. cuenta", "cod cuenta", "account"],
      concepto: ["concepto", "descripcion", "descripción", "comentario"],
      debe: ["debe", "debito", "débito"],
      haber: ["haber", "credito", "crédito"],
      asiento: ["asiento", "n.asiento", "n asiento"],
      documento: ["documento", "doc"],
    },
    exportHeaders: ["FECHA", "ASIENTO", "CUENTA", "CONCEPTO", "DEBE", "HABER", "DOCUMENTO"],
  },
  {
    id: "generic",
    name: "CSV / Excel genérico",
    vendor: "Estándar",
    description: "Plantilla libre con columnas mínimas: fecha, cuenta, concepto, debe, haber.",
    extensions: [".csv", ".xlsx", ".xls", ".txt"],
    csvDelimiter: ",",
    columnAliases: {
      fecha: ["fecha", "date"],
      cuenta: ["cuenta", "account", "codigo", "código"],
      concepto: ["concepto", "descripcion", "descripción", "description"],
      debe: ["debe", "debit"],
      haber: ["haber", "credit"],
    },
    exportHeaders: ["fecha", "cuenta", "concepto", "debe", "haber"],
  },
]

export function getAccountingFormatProfile(
  format: AccountingSourceFormat,
): AccountingFormatProfile {
  return (
    ACCOUNTING_FORMAT_PROFILES.find((profile) => profile.id === format) ??
    ACCOUNTING_FORMAT_PROFILES.find((profile) => profile.id === "generic")!
  )
}

export function encodeImportFormatLabel(
  sourceFormat: AccountingSourceFormat,
  fileFormat: string,
): string {
  return `${sourceFormat}:${fileFormat}`
}

export function decodeImportFormatLabel(label: string): {
  sourceFormat: AccountingSourceFormat
  fileFormat: string
} {
  const [source, file] = label.split(":")
  const sourceFormat = ACCOUNTING_FORMAT_PROFILES.some((p) => p.id === source)
    ? (source as AccountingSourceFormat)
    : "generic"
  return { sourceFormat, fileFormat: file ?? label }
}

export function formatSourceFormatLabel(sourceFormat: AccountingSourceFormat): string {
  return getAccountingFormatProfile(sourceFormat).name
}

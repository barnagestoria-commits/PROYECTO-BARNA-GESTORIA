import { ACCOUNTING_COMMANDS, COMMAND_CODES } from "@/lib/accounting/command-templates"
import { A3_TOOLBAR_GROUPS } from "@/lib/navigation/a3-toolbar"
import type { CommandPaletteItem } from "@/lib/search/command-palette-types"

function navItem(
  id: string,
  title: string,
  href: string,
  subtitle?: string,
  keywords: string[] = [],
): CommandPaletteItem {
  return {
    id,
    kind: "navigation",
    title,
    subtitle,
    href,
    keywords: [title, subtitle ?? "", href, ...keywords].filter(Boolean),
  }
}

function actionItem(
  id: string,
  title: string,
  href: string,
  subtitle?: string,
  keywords: string[] = [],
): CommandPaletteItem {
  return {
    id,
    kind: "action",
    title,
    subtitle,
    href,
    keywords: [title, subtitle ?? "", ...keywords],
  }
}

export const STATIC_COMMAND_PALETTE_ITEMS: CommandPaletteItem[] = [
  navItem("nav-documentos", "Ir a Facturas recibidas", "/dashboard/compras/facturas-recibidas", "Subida y gestión de facturas", [
    "documentos",
    "facturas",
    "upload",
    "subida",
  ]),
  navItem(
    "nav-contactos",
    "Ir a Clientes y Proveedores",
    "/dashboard/contactos",
    "Directorio de terceros",
    ["contactos", "clientes", "proveedores", "nif", "terceros"],
  ),
  navItem("nav-asientos", "Ir a Asientos", "/dashboard/contabilidad", "Contabilización y diario", [
    "asientos",
    "contabilidad",
    "diario",
    "contabilización",
  ]),
  navItem("nav-fiscal", "Ir a Modelos fiscales", "/dashboard/fiscal", "Vista panorámica trimestral", [
    "impuestos",
    "fiscal",
    "modelos",
    "hacienda",
  ]),
  navItem(
    "nav-pagar-devolver",
    "Ir a A pagar / devolver",
    "/dashboard/fiscal/pagar-devolver",
    "IVA y retenciones del trimestre",
    ["iva", "retenciones", "pagar", "devolver"],
  ),
  navItem(
    "nav-inmovilizado",
    "Ir a Inmovilizado",
    "/dashboard/inmovilizado",
    "Activos fijos y amortizaciones",
    ["activos", "amortización", "21x"],
  ),
  navItem(
    "nav-importar",
    "Importar datos contables",
    "/dashboard/utilidades/importar",
    "A3, Holded, Sage y CSV",
    ["importar", "exportar", "csv", "excel", "a3", "holded", "importación"],
  ),
  ...A3_TOOLBAR_GROUPS.flatMap((group) =>
    group.items.map((item) =>
      navItem(
        `nav-${item.id}`,
        item.label,
        item.href,
        item.description ?? group.label,
        [group.label, group.shortLabel ?? "", item.id],
      ),
    ),
  ),
  actionItem(
    "action-subir-recibida",
    "Subir factura recibida",
    "/dashboard/compras/facturas-recibidas",
    "OCR automático de proveedor e importes",
    ["factura", "recibida", "compra", "proveedor", "gasto", "ocr"],
  ),
  actionItem(
    "action-subir-emitida",
    "Subir factura emitida",
    "/dashboard/ventas/facturas-emitidas",
    "Ventas y facturas de tu empresa",
    ["factura", "emitida", "venta", "cliente"],
  ),
  actionItem(
    "action-subir-extracto",
    "Subir extracto bancario",
    "/dashboard/contabilidad/conciliacion-bancaria",
    "Conciliación bancaria y movimientos del periodo",
    ["extracto", "banco", "bancario", "57", "conciliación", "tesorería"],
  ),
  actionItem(
    "action-nuevo-asiento",
    "Crear nuevo asiento",
    "/dashboard/contabilidad",
    "Abrir contabilización rápida",
    ["asiento", "apunte", "contabilizar", "nuevo"],
  ),
  actionItem(
    "action-nuevo-cliente",
    "Crear nuevo cliente contable",
    "/dashboard/contabilidad?comando=17",
    "Plantilla de factura emitida (cuenta 430)",
    ["cliente", "430", "crear", "nuevo cliente"],
  ),
  actionItem(
    "action-nuevo-proveedor",
    "Registrar factura de proveedor",
    "/dashboard/contabilidad?comando=34",
    "Plantilla de factura recibida (cuenta 400)",
    ["proveedor", "400", "compra", "crear proveedor"],
  ),
  ...COMMAND_CODES.map((code) =>
    actionItem(
      `action-comando-${code}`,
      `Comando ${code}: ${ACCOUNTING_COMMANDS[code].label}`,
      `/dashboard/contabilidad?comando=${code}`,
      ACCOUNTING_COMMANDS[code].description,
      [code, "comando", "plantilla", "atajo"],
    ),
  ),
]

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function filterStaticCommandItems(query: string, limit = 12): CommandPaletteItem[] {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) {
    return STATIC_COMMAND_PALETTE_ITEMS.slice(0, limit)
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)

  return STATIC_COMMAND_PALETTE_ITEMS.filter((item) => {
    const haystack = normalize(
      [item.title, item.subtitle ?? "", ...(item.keywords ?? [])].join(" "),
    )
    return tokens.every((token) => haystack.includes(token))
  }).slice(0, limit)
}

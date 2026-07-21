import type { LucideIcon } from "lucide-react"
import type { ReportType } from "@/lib/reports/types"

export interface A3ToolbarItem {
  id: string
  label: string
  description?: string
  href: string
  pdfReportType?: ReportType
  icon?: LucideIcon
  badge?: string
  external?: boolean
}

export interface A3ToolbarGroup {
  id: string
  label: string
  shortLabel?: string
  items: A3ToolbarItem[]
}

export const A3_TOOLBAR_GROUPS: A3ToolbarGroup[] = [
  {
    id: "listados",
    label: "Listados Contables",
    shortLabel: "Listados",
    items: [
      {
        id: "balance",
        label: "Balance de Situación",
        description: "Activo, pasivo y patrimonio neto",
        href: "/dashboard/informes/balance",
        pdfReportType: "balance",
      },
      {
        id: "sumas-saldos",
        label: "Sumas y Saldos",
        description: "Mayor resumido por cuenta",
        href: "/dashboard/informes/sumas-saldos",
        pdfReportType: "sumas-saldos",
      },
      {
        id: "pyg",
        label: "Pérdidas y Ganancias (PyG)",
        description: "Cuenta de resultados del ejercicio",
        href: "/dashboard/informes/pyg",
        pdfReportType: "pyg",
      },
    ],
  },
  {
    id: "impuestos",
    label: "Impuestos / Modelos",
    shortLabel: "Modelos",
    items: [
      {
        id: "panorama",
        label: "Vista panorámica fiscal",
        description: "Matriz trimestral de modelos",
        href: "/dashboard/fiscal",
      },
      {
        id: "pagar-devolver",
        label: "A pagar / devolver",
        description: "IVA (472/477) + retenciones combinadas",
        href: "/dashboard/fiscal/pagar-devolver",
        badge: "Resumen",
      },
      {
        id: "m111",
        label: "Modelo 111 — Retenciones IRPF",
        description: "Trabajo y actividades profesionales (4731)",
        href: "/dashboard/fiscal/111",
      },
      {
        id: "m115",
        label: "Modelo 115 — Retenciones IRPF",
        description: "Arrendamientos de inmuebles (4732)",
        href: "/dashboard/fiscal/115",
      },
      {
        id: "m180",
        label: "Modelo 180 — Resumen anual",
        description: "Retenciones alquileres acumuladas (4751)",
        href: "/dashboard/fiscal/180",
      },
      {
        id: "m303",
        label: "Modelo 303 — IVA trimestral",
        description: "Autoliquidación repercutido / soportado",
        href: "/dashboard/fiscal/303",
      },
    ],
  },
  {
    id: "certificados",
    label: "Certificados",
    items: [
      {
        id: "cert-180",
        label: "Certificados Mod. 180 — Alquileres",
        description: "Retenciones 4751 en tiempo real desde asientos",
        href: "/dashboard/informes/certificados/modelo-180",
        badge: "180",
      },
      {
        id: "retenciones-profesionales",
        label: "Certificado retenciones — Profesionales",
        description: "Modelo 111 / retenciones practicadas",
        href: "/dashboard/informes/certificados/retenciones-profesionales",
      },
      {
        id: "retenciones-alquiler",
        label: "Certificado retenciones — Alquileres",
        description: "Modelo 115 / arrendamientos urbanos",
        href: "/dashboard/informes/certificados/retenciones-alquiler",
      },
      {
        id: "retenciones-resumen",
        label: "Resumen anual de retenciones",
        description: "Consolidado por cliente y ejercicio",
        href: "/dashboard/informes/certificados/resumen-anual",
      },
    ],
  },
  {
    id: "inmovilizado",
    label: "Inmovilizado",
    shortLabel: "Inmov.",
    items: [
      {
        id: "mantenimiento",
        label: "Mantenimiento de Inmovilizado",
        description: "Fichas de activos 21x / 281x / 681x",
        href: "/dashboard/inmovilizado",
      },
      {
        id: "parametrizacion",
        label: "Parametrización de amortizaciones",
        description: "Periodificación mensual, trimestral o anual",
        href: "/dashboard/inmovilizado/parametrizacion",
      },
      {
        id: "generar-amort",
        label: "Generar amortizaciones del periodo",
        description: "Asiento manual de amortización del periodo activo",
        href: "/dashboard/inmovilizado/parametrizacion#generar",
      },
    ],
  },
  {
    id: "utilidades",
    label: "Utilidades",
    items: [
      {
        id: "importar",
        label: "Importar datos contables",
        description: "Subir CSV/Excel de facturas y movimientos externos",
        href: "/dashboard/utilidades/importar",
      },
    ],
  },
]

export function getPageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard"
  if (pathname.startsWith("/dashboard/contactos")) return "Clientes y Proveedores"
  if (pathname.startsWith("/dashboard/contabilidad")) return "Contabilización"
  if (pathname.startsWith("/dashboard/inmovilizado/parametrizacion")) return "Parametrización"
  if (pathname.startsWith("/dashboard/inmovilizado")) return "Mantenimiento de Inmovilizado"
  if (pathname.startsWith("/dashboard/utilidades/importar")) return "Importar Datos"
  if (pathname.startsWith("/dashboard/fiscal/pagar-devolver")) return "A pagar / devolver"
  if (pathname.match(/^\/dashboard\/fiscal\/\d{3}\/\d{4}/)) return "Borrador fiscal"
  if (pathname.match(/^\/dashboard\/fiscal\/\d{3}$/)) {
    const model = pathname.split("/").pop()
    return `Modelo ${model}`
  }
  if (pathname.startsWith("/dashboard/fiscal/resumen")) return "Resumen fiscal"
  if (pathname.startsWith("/dashboard/fiscal")) return "Vista Panorámica Fiscal"
  if (pathname.includes("/informes/balance")) return "Balance de Situación"
  if (pathname.includes("/informes/sumas-saldos")) return "Sumas y Saldos"
  if (pathname.includes("/informes/pyg")) return "Pérdidas y Ganancias"
  if (pathname.includes("/informes/certificados/modelo-180")) return "Certificados Mod. 180"
  if (pathname.includes("/informes/certificados")) return "Certificados"
  return "Panel de gestión"
}

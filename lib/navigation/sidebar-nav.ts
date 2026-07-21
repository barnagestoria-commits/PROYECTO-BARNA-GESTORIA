import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  BookOpen,
  Home,
  Landmark,
  LineChart,
  ScanLine,
  ShoppingCart,
  Users,
} from "lucide-react"

export interface SidebarNavLink {
  label: string
  href: string
  description?: string
  badge?: string
}

export interface SidebarNavSection {
  title: string
  items: SidebarNavLink[]
}

export interface SidebarNavModule {
  id: string
  label: string
  icon: LucideIcon
  /** Enlace directo (ej. Inicio) sin flyout */
  href?: string
  sections?: SidebarNavSection[]
}

export const SIDEBAR_WIDTH_CLASS = "w-[240px]"
export const SIDEBAR_FLYOUT_WIDTH_CLASS = "w-[300px]"

export const SIDEBAR_NAV_MODULES: SidebarNavModule[] = [
  {
    id: "inicio",
    label: "Inicio",
    icon: Home,
    href: "/dashboard",
  },
  {
    id: "contactos",
    label: "Cliente/Proveedor",
    icon: Users,
    sections: [
      {
        title: "Directorio",
        items: [
          {
            label: "Clientes",
            href: "/dashboard/contabilidad",
            description: "Cartera de clientes y cuentas 430",
          },
          {
            label: "Proveedores",
            href: "/dashboard/contabilidad",
            description: "Proveedores habituales y cuentas 400",
          },
          {
            label: "Terceros y CIF",
            href: "/dashboard/contabilidad",
            description: "Alta y mantenimiento de terceros",
          },
        ],
      },
    ],
  },
  {
    id: "ventas",
    label: "Ventas",
    icon: LineChart,
    sections: [
      {
        title: "Facturación emitida",
        items: [
          {
            label: "Facturas emitidas",
            href: "/dashboard?accion=subir-factura-emitida",
            description: "Registro y envío de facturas de venta",
          },
          {
            label: "Presupuestos",
            href: "/dashboard",
            description: "Crear y convertir presupuestos",
            badge: "Próx.",
          },
          {
            label: "Ingresos del periodo",
            href: "/dashboard/informes/pyg",
            description: "Consultar cuenta de resultados",
          },
        ],
      },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    icon: ShoppingCart,
    sections: [
      {
        title: "Gastos y compras",
        items: [
          {
            label: "Facturas recibidas",
            href: "/dashboard?accion=subir-factura-recibida",
            description: "Gastos, proveedores y OCR",
          },
          {
            label: "Gastos deducibles",
            href: "/dashboard/contabilidad",
            description: "Clasificación contable de gastos",
          },
          {
            label: "Extractos bancarios",
            href: "/dashboard?accion=subir-extracto",
            description: "Conciliación con movimientos bancarios",
          },
        ],
      },
    ],
  },
  {
    id: "importacion",
    label: "Importación",
    icon: ScanLine,
    sections: [
      {
        title: "Captura documental",
        items: [
          {
            label: "Subir factura / extracto",
            href: "/dashboard?accion=subir-factura-recibida",
            description: "Cámara, archivo o arrastrar PDF",
          },
          {
            label: "Centro de documentos",
            href: "/dashboard",
            description: "Historial de archivos subidos",
          },
          {
            label: "Importar datos contables",
            href: "/dashboard/utilidades/importar",
            description: "CSV, Excel y movimientos externos",
          },
        ],
      },
    ],
  },
  {
    id: "contabilidad",
    label: "Contabilidad",
    icon: BookOpen,
    sections: [
      {
        title: "Libros y asientos",
        items: [
          {
            label: "Libro diario / Asientos",
            href: "/dashboard/contabilidad",
            description: "Contabilización estilo A3",
          },
          {
            label: "Plan general contable",
            href: "/dashboard/contabilidad",
            description: "Consulta de cuentas PGC",
          },
          {
            label: "Sumas y saldos",
            href: "/dashboard/informes/sumas-saldos",
            description: "Mayor resumido por cuenta",
          },
        ],
      },
      {
        title: "Inmovilizado",
        items: [
          {
            label: "Mantenimiento inmovilizado",
            href: "/dashboard/inmovilizado",
            description: "Fichas de activos 21x / 281x",
          },
          {
            label: "Parametrización amortizaciones",
            href: "/dashboard/inmovilizado/parametrizacion",
            description: "Periodificación y generación",
          },
        ],
      },
    ],
  },
  {
    id: "impuestos",
    label: "Impuestos",
    icon: Landmark,
    sections: [
      {
        title: "Modelos fiscales",
        items: [
          {
            label: "Vista panorámica fiscal",
            href: "/dashboard/fiscal",
            description: "Matriz trimestral de modelos",
          },
          {
            label: "A pagar / devolver",
            href: "/dashboard/fiscal/pagar-devolver",
            description: "IVA + retenciones combinadas",
            badge: "Resumen",
          },
          {
            label: "Modelo 303 — IVA",
            href: "/dashboard/fiscal/303",
            description: "Autoliquidación trimestral",
          },
          {
            label: "Modelo 111 — Retenciones",
            href: "/dashboard/fiscal/111",
            description: "Trabajo y profesionales",
          },
          {
            label: "Modelo 115 — Alquileres",
            href: "/dashboard/fiscal/115",
            description: "Retenciones arrendamientos",
          },
        ],
      },
      {
        title: "Certificados",
        items: [
          {
            label: "Certificados Mod. 180",
            href: "/dashboard/informes/certificados/modelo-180",
            description: "Retenciones alquileres",
          },
          {
            label: "Resumen anual retenciones",
            href: "/dashboard/informes/certificados/resumen-anual",
            description: "Consolidado por cliente",
          },
        ],
      },
    ],
  },
  {
    id: "analitica",
    label: "Analítica",
    icon: BarChart3,
    sections: [
      {
        title: "Informes financieros",
        items: [
          {
            label: "Balance de situación",
            href: "/dashboard/informes/balance",
            description: "Activo, pasivo y patrimonio",
          },
          {
            label: "Pérdidas y ganancias",
            href: "/dashboard/informes/pyg",
            description: "Cuenta de resultados",
          },
          {
            label: "Sumas y saldos",
            href: "/dashboard/informes/sumas-saldos",
            description: "Mayor resumido",
          },
        ],
      },
      {
        title: "Exportación",
        items: [
          {
            label: "Informes PDF / Excel",
            href: "/dashboard/informes/balance",
            description: "Exportar listados contables",
          },
        ],
      },
    ],
  },
]

export const SIDEBAR_FOOTER_LINKS = [
  { label: "Ayuda", href: "/dashboard", action: "tour" as const },
  { label: "Soporte", href: "/contact" },
] as const

export function isNavLinkActive(href: string, pathname: string, searchParams?: string): boolean {
  const [path, query] = href.split("?")
  if (query && searchParams) {
    const target = new URLSearchParams(query)
    const current = new URLSearchParams(searchParams)
    const accion = target.get("accion")
    if (accion && current.get("accion") === accion && pathname === path) return true
  }
  if (path === "/dashboard" && !query) {
    return pathname === "/dashboard" && !searchParams?.includes("accion=")
  }
  if (path === "/dashboard/fiscal") {
    return pathname === "/dashboard/fiscal" || pathname.startsWith("/dashboard/fiscal/")
  }
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function isSidebarModuleActive(
  navModule: SidebarNavModule,
  pathname: string,
  searchParams?: string,
): boolean {
  if (navModule.href) {
    return isNavLinkActive(navModule.href, pathname, searchParams)
  }
  return (
    navModule.sections?.some((section) =>
      section.items.some((item) => isNavLinkActive(item.href, pathname, searchParams)),
    ) ?? false
  )
}

export function getActiveModuleId(
  pathname: string,
  searchParams?: string,
): string | null {
  for (const navModule of SIDEBAR_NAV_MODULES) {
    if (isSidebarModuleActive(navModule, pathname, searchParams)) {
      return navModule.id
    }
  }
  return null
}

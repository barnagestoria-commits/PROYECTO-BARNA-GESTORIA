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
    href: "/dashboard/contactos",
    sections: [
      {
        title: "Directorio",
        items: [
          {
            label: "Directorio completo",
            href: "/dashboard/contactos",
            description: "Clientes, proveedores y terceros",
          },
          {
            label: "Clientes",
            href: "/dashboard/contactos",
            description: "Cartera de clientes y cuentas 430",
          },
          {
            label: "Proveedores",
            href: "/dashboard/contactos",
            description: "Proveedores habituales y cuentas 400",
          },
        ],
      },
    ],
  },
  {
    id: "ventas",
    label: "Ventas",
    icon: LineChart,
    href: "/dashboard/ventas/facturas-emitidas",
    sections: [
      {
        title: "Facturación emitida",
        items: [
          {
            label: "Facturas emitidas",
            href: "/dashboard/ventas/facturas-emitidas",
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
    href: "/dashboard/compras/facturas-recibidas",
    sections: [
      {
        title: "Gastos y compras",
        items: [
          {
            label: "Facturas recibidas",
            href: "/dashboard/compras/facturas-recibidas",
            description: "Gastos, proveedores y OCR",
          },
          {
            label: "Gastos deducibles",
            href: "/dashboard/contabilidad",
            description: "Clasificación contable de gastos",
          },
        ],
      },
    ],
  },
  {
    id: "importacion",
    label: "Importación",
    icon: ScanLine,
    href: "/dashboard/utilidades/importar",
    sections: [
      {
        title: "Intercambio contable",
        items: [
          {
            label: "Importar datos contables",
            href: "/dashboard/utilidades/importar",
            description: "A3, Holded, Sage y CSV/Excel genérico",
          },
          {
            label: "Exportar asientos",
            href: "/dashboard/utilidades/importar?tab=exportar",
            description: "Descargar diario compatible con A3 / Holded",
          },
          {
            label: "Historial de importaciones",
            href: "/dashboard/utilidades/importar?tab=historial",
            description: "Ficheros procesados recientemente",
          },
        ],
      },
      {
        title: "Captura documental",
        items: [
          {
            label: "Facturas recibidas",
            href: "/dashboard/compras/facturas-recibidas",
            description: "Cámara, archivo o arrastrar PDF",
          },
          {
            label: "Facturas emitidas",
            href: "/dashboard/ventas/facturas-emitidas",
            description: "Ventas y facturas de tu empresa",
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
      {
        title: "Conciliación bancaria",
        items: [
          {
            label: "Extractos bancarios",
            href: "/dashboard/contabilidad/conciliacion-bancaria",
            description: "Movimientos bancarios y conciliación de tesorería",
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
  if (path === "/dashboard/importacion") {
    return pathname === "/dashboard/importacion" || pathname.startsWith("/dashboard/importacion/")
  }
  if (path === "/dashboard/utilidades/importar") {
    return pathname === "/dashboard/utilidades/importar"
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

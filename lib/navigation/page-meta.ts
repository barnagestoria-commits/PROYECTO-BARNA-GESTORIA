import { getPageTitle } from "@/lib/navigation/accounting-toolbar"
import { getActiveModuleId, SIDEBAR_NAV_MODULES } from "@/lib/navigation/sidebar-nav"

export function getPageBreadcrumb(pathname: string): string {
  if (pathname.startsWith("/configuracion/certificado")) {
    return "Configuración / Certificado digital"
  }
  if (pathname.startsWith("/configuracion")) {
    return "Configuración / Perfil de cuenta"
  }
  if (pathname === "/dashboard") {
    return "Inicio"
  }

  const activeModuleId = getActiveModuleId(pathname)
  const activeModule = SIDEBAR_NAV_MODULES.find((module) => module.id === activeModuleId)
  const pageTitle = getPageTitle(pathname)

  if (activeModule && pageTitle !== activeModule.label) {
    return `${activeModule.label} / ${pageTitle}`
  }

  if (activeModule) {
    return activeModule.label
  }

  return pageTitle
}

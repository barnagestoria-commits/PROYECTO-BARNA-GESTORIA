/**
 * El tour compara rutas de forma exacta.
 * `/configuracion/certificado` no es `/configuracion`: si se trata como prefijo,
 * "Siguiente" tras el certificado no navega y la guía se queda congelada.
 */
export function tourRouteMatches(pathname: string, route: string): boolean {
  return pathname === route
}

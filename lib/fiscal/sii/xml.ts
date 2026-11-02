import type { SiiBook, SiiInvoiceDraft } from "@/lib/fiscal/sii/types"

const SII_NS = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/ssii/fact/ws/SuministroInformacion.xsd"
const SII_LR_NS = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/ssii/fact/ws/SuministroLR.xsd"

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function money(value: number): string {
  return value.toFixed(2)
}

function contraparte(invoice: SiiInvoiceDraft): string {
  if (!invoice.nif) return ""
  return `<sii:Contraparte><sii:NombreRazon>${escapeXml(invoice.nombre)}</sii:NombreRazon><sii:NIF>${escapeXml(invoice.nif)}</sii:NIF></sii:Contraparte>`
}

function desgloseEmitida(invoice: SiiInvoiceDraft): string {
  const detalles = invoice.detalles
    .map(
      (line) =>
        `<sii:DetalleIVA><sii:TipoImpositivo>${money(line.tipo)}</sii:TipoImpositivo><sii:BaseImponible>${money(line.base)}</sii:BaseImponible><sii:CuotaRepercutida>${money(line.cuota)}</sii:CuotaRepercutida></sii:DetalleIVA>`,
    )
    .join("")
  return `<sii:TipoDesglose><sii:DesgloseFactura><sii:Sujeta><sii:NoExenta><sii:TipoNoExenta>S1</sii:TipoNoExenta><sii:DesgloseIVA>${detalles}</sii:DesgloseIVA></sii:NoExenta></sii:Sujeta></sii:DesgloseFactura></sii:TipoDesglose>`
}

function desgloseRecibida(invoice: SiiInvoiceDraft): string {
  const detalles = invoice.detalles
    .map(
      (line) =>
        `<sii:DetalleIVA><sii:TipoImpositivo>${money(line.tipo)}</sii:TipoImpositivo><sii:BaseImponible>${money(line.base)}</sii:BaseImponible><sii:CuotaSoportada>${money(line.cuota)}</sii:CuotaSoportada></sii:DetalleIVA>`,
    )
    .join("")
  return `<sii:DesgloseFactura><sii:Sujeta><sii:NoExenta><sii:TipoNoExenta>S1</sii:TipoNoExenta><sii:DesgloseIVA>${detalles}</sii:DesgloseIVA></sii:NoExenta></sii:Sujeta></sii:DesgloseFactura>`
}

function registro(invoice: SiiInvoiceDraft, titularNif: string): string {
  const periodo = `<sii:PeriodoLiquidacion><sii:Ejercicio>${invoice.ejercicio}</sii:Ejercicio><sii:Periodo>${invoice.periodo}</sii:Periodo></sii:PeriodoLiquidacion>`
  const emisorNif = invoice.book === "EMITIDAS" ? titularNif : invoice.nif
  const idFactura = `<siiLR:IDFactura><sii:IDEmisorFactura><sii:NIF>${escapeXml(emisorNif)}</sii:NIF></sii:IDEmisorFactura><sii:NumSerieFacturaEmisor>${escapeXml(invoice.numero)}</sii:NumSerieFacturaEmisor><sii:FechaExpedicionFacturaEmisor>${invoice.fechaExpedicion}</sii:FechaExpedicionFacturaEmisor></siiLR:IDFactura>`
  if (invoice.book === "EMITIDAS") {
    return `<siiLR:RegistroLRFacturasEmitidas>${periodo}${idFactura}<siiLR:FacturaExpedida><sii:TipoFactura>${invoice.tipoFactura}</sii:TipoFactura><sii:ClaveRegimenEspecialOTrascendencia>${invoice.claveRegimen}</sii:ClaveRegimenEspecialOTrascendencia><sii:ImporteTotal>${money(invoice.importeTotal)}</sii:ImporteTotal><sii:DescripcionOperacion>${escapeXml(invoice.descripcion)}</sii:DescripcionOperacion>${contraparte(invoice)}${desgloseEmitida(invoice)}</siiLR:FacturaExpedida></siiLR:RegistroLRFacturasEmitidas>`
  }
  const deducible = money(invoice.detalles.reduce((sum, line) => sum + line.cuota, 0))
  return `<siiLR:RegistroLRFacturasRecibidas>${periodo}${idFactura}<siiLR:FacturaRecibida><sii:TipoFactura>${invoice.tipoFactura}</sii:TipoFactura><sii:ClaveRegimenEspecialOTrascendencia>${invoice.claveRegimen}</sii:ClaveRegimenEspecialOTrascendencia><sii:ImporteTotal>${money(invoice.importeTotal)}</sii:ImporteTotal><sii:DescripcionOperacion>${escapeXml(invoice.descripcion)}</sii:DescripcionOperacion>${desgloseRecibida(invoice)}${contraparte(invoice)}<sii:FechaRegContable>${invoice.fechaRegistro}</sii:FechaRegContable><sii:CuotaDeducible>${deducible}</sii:CuotaDeducible></siiLR:FacturaRecibida></siiLR:RegistroLRFacturasRecibidas>`
}

export function buildSiiSoap(params: {
  book: SiiBook
  titularNif: string
  titularNombre: string
  invoices: SiiInvoiceDraft[]
}): string {
  const root = params.book === "EMITIDAS" ? "SuministroLRFacturasEmitidas" : "SuministroLRFacturasRecibidas"
  const body = params.invoices.map((invoice) => registro(invoice, params.titularNif)).join("")
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:siiLR="${SII_LR_NS}" xmlns:sii="${SII_NS}"><soapenv:Header/><soapenv:Body><siiLR:${root}><sii:Cabecera><sii:IDVersionSii>1.1</sii:IDVersionSii><sii:Titular><sii:NombreRazon>${escapeXml(params.titularNombre)}</sii:NombreRazon><sii:NIF>${escapeXml(params.titularNif)}</sii:NIF></sii:Titular><sii:TipoComunicacion>A0</sii:TipoComunicacion></sii:Cabecera>${body}</siiLR:${root}></soapenv:Body></soapenv:Envelope>`
}

export function siiEndpoint(book: SiiBook, environment: "sandbox" | "production"): string {
  const host = environment === "production" ? "https://www1.agenciatributaria.gob.es" : "https://prewww1.aeat.es"
  const path = book === "EMITIDAS" ? "/wlpl/SSII-FACT/ws/fe/SiiFactFEV1SOAP" : "/wlpl/SSII-FACT/ws/fr/SiiFactFRV1SOAP"
  return `${host}${path}`
}

export function siiSoapAction(book: SiiBook): string {
  const operation = book === "EMITIDAS" ? "SuministroLRFacturasEmitidas" : "SuministroLRFacturasRecibidas"
  return `${SII_LR_NS}#${operation}`
}

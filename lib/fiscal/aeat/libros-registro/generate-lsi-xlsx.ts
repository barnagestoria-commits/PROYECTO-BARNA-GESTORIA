import ExcelJS from "exceljs"
import type {
  IssuedLibrosRow,
  LibrosRegistroBooks,
  ReceivedLibrosRow,
} from "@/lib/fiscal/aeat/libros-registro/types"

const ISSUED_GROUP_HEADERS = [
  "Autoliquidación(11)",
  "Autoliquidación(11)",
  "Actividad(16)",
  "Actividad(16)",
  "Actividad(16)",
  "Tipo de Factura(9)",
  "Concepto de Ingreso(10) (17)",
  "Ingreso Computable(13) (17)",
  "Fecha Expedición(25)",
  "Fecha Operación(1)",
  "Identificación de la Factura",
  "Identificación de la Factura",
  "Identificación de la Factura",
  "NIF Destinatario(2)",
  "NIF Destinatario(2)",
  "NIF Destinatario(2)",
  "Nombre Destinatario",
  "Clave de Operación(6)(23)",
  "Calificación de la Operación(19) (21) (22) (23) (24) (30)",
  "Operación Exenta(20)",
  "Total Factura(37)",
  "Base Imponible",
  "Tipo de IVA(39)",
  "Cuota IVA Repercutida",
  "Tipo de Recargo Eq.",
  "Cuota Recargo Eq.(35)",
  "Cobro (Operación Criterio de Caja de IVA y/o artículo 7.2.1º de Reglamento del IRPF)",
  "Cobro (Operación Criterio de Caja de IVA y/o artículo 7.2.1º de Reglamento del IRPF)",
  "Cobro (Operación Criterio de Caja de IVA y/o artículo 7.2.1º de Reglamento del IRPF)",
  "Cobro (Operación Criterio de Caja de IVA y/o artículo 7.2.1º de Reglamento del IRPF)",
  "Tipo Retención del IRPF(15) (17)",
  "Importe Retenido del IRPF(15) (17)",
  "Registro Acuerdo Facturación(18)",
  "Inmueble(40)",
  "Inmueble(40)",
  "Referencia Externa",
]

const ISSUED_HEADERS = [
  "Ejercicio",
  "Periodo",
  "Código",
  "Tipo",
  "Grupo o Epígrafe del IAE",
  "Tipo de Factura(9)",
  "Concepto de Ingreso(10) (17)",
  "Ingreso Computable(13) (17)",
  "Fecha Expedición(25)",
  "Fecha Operación(1)",
  "Serie",
  "Número",
  "Número-Final",
  "Tipo",
  "Código País",
  "Identificación",
  "Nombre Destinatario",
  "Clave de Operación(6)(23)",
  "Calificación de la Operación(19) (21) (22) (23) (24) (30)",
  "Operación Exenta(20)",
  "Total Factura(37)",
  "Base Imponible",
  "Tipo de IVA(39)",
  "Cuota IVA Repercutida",
  "Tipo de Recargo Eq.",
  "Cuota Recargo Eq.(35)",
  "Fecha",
  "Importe",
  "Medio Utilizado",
  "Identificación Medio Utilizado",
  "Tipo Retención del IRPF(15) (17)",
  "Importe Retenido del IRPF(15) (17)",
  "Registro Acuerdo Facturación(18)",
  "Situación",
  "Referencia Catastral",
  "Referencia Externa",
]

const RECEIVED_GROUP_HEADERS = [
  "Autoliquidación(12)",
  "Autoliquidación(12)",
  "Actividad(17)",
  "Actividad(17)",
  "Actividad(17)",
  "Tipo de Factura(10)",
  "Concepto de Gasto(11) (18)",
  "Gasto Deducible(13) (18)",
  "Fecha Expedición",
  "Fecha Operación(1)",
  "Identificación Factura del Expedidor",
  "Identificación Factura del Expedidor",
  "Fecha Recepción(19)",
  "Número Recepción(37)",
  "Número Recepción Final(37)",
  "NIF Expedidor(2)",
  "NIF Expedidor(2)",
  "NIF Expedidor(2)",
  "Nombre Expedidor",
  "Clave de Operación(7)",
  "Bien de Inversión(20)",
  "Inversión del Sujeto Pasivo(23)",
  "Deducible en Periodo Posterior(21) (35)",
  "Periodo Deducción(22) (34)",
  "Periodo Deducción(22) (34)",
  "Total Factura",
  "Base Imponible",
  "Tipo de IVA",
  "Cuota IVA Soportado",
  "Cuota Deducible(36)",
  "Tipo de Recargo Eq.",
  "Cuota Recargo Eq.",
  "Pago (Operación Criterio de Caja de IVA y/o artículo 7.2.1º de Reglamento del IRPF)",
  "Pago (Operación Criterio de Caja de IVA y/o artículo 7.2.1º de Reglamento del IRPF)",
  "Pago (Operación Criterio de Caja de IVA y/o artículo 7.2.1º de Reglamento del IRPF)",
  "Pago (Operación Criterio de Caja de IVA y/o artículo 7.2.1º de Reglamento del IRPF)",
  "Tipo Retención del IRPF(16) (18)",
  "Importe Retenido del IRPF(16) (18)",
  "Registro Acuerdo Facturación(24)",
  "Inmueble(39)",
  "Inmueble(39)",
  "Referencia Externa",
]

const RECEIVED_HEADERS = [
  "Ejercicio",
  "Periodo",
  "Código",
  "Tipo",
  "Grupo o Epígrafe del IAE",
  "Tipo de Factura(10)",
  "Concepto de Gasto(11) (18)",
  "Gasto Deducible(13) (18)",
  "Fecha Expedición",
  "Fecha Operación(1)",
  "(Serie-Número)",
  "Número-Final",
  "Fecha Recepción(19)",
  "Número Recepción(37)",
  "Número Recepción Final(37)",
  "Tipo",
  "Código País",
  "Identificación",
  "Nombre Expedidor",
  "Clave de Operación(7)",
  "Bien de Inversión(20)",
  "Inversión del Sujeto Pasivo(23)",
  "Deducible en Periodo Posterior(21) (35)",
  "Ejercicio",
  "Periodo",
  "Total Factura",
  "Base Imponible",
  "Tipo de IVA",
  "Cuota IVA Soportado",
  "Cuota Deducible(36)",
  "Tipo de Recargo Eq.",
  "Cuota Recargo Eq.",
  "Fecha",
  "Importe",
  "Medio Utilizado",
  "Identificación Medio Utilizado",
  "Tipo Retención del IRPF(16) (18)",
  "Importe Retenido del IRPF(16) (18)",
  "Registro Acuerdo Facturación(24)",
  "Situación",
  "Referencia Catastral",
  "Referencia Externa",
]

const INVESTMENT_HEADERS = [
  "Ejercicio",
  "Periodo",
  "Código",
  "Tipo",
  "Grupo o Epígrafe del IAE",
  "Tipo de Bien(2)",
  "Identificador",
  "Literal",
  "Fecha Inicio Utilización",
  "Valor Adquisición(11)",
  "Valor Amortizable(11)",
  "Método de Amortización(4) (11)",
  "Porcentaje de Amortización(11)",
  "Acumulada al Inicio",
  "Cuota Resultante",
  "Acumulada al final",
  "Pendiente",
  "Fecha Expedición",
  "(Serie-Número)",
  "Número-Final",
  "Número Recepción(11)",
  "Número Recepción Final(11)",
  "Tipo",
  "Código País",
  "Identificación",
  "Nombre Expedidor",
  "Base Imponible",
  "Tipo de IVA",
  "Prorrata Definitiva(14)",
  "Cuota Deducible(14)",
  "Prorrata Definitiva",
  "Cuota Deducible",
  "Cuota a Regularizar",
  "Fecha(18)",
  "Causa(8) (11)",
  "Serie",
  "Número",
  "Número-Final",
  "Registro Acuerdo Facturación(19)",
  "Referencia Externa",
]

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } }
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF145A32" } }
  row.alignment = { wrapText: true, vertical: "middle" }
}

function writeMeta(
  sheet: ExcelJS.Worksheet,
  title: string,
  params: { year: number; nif: string; name: string; bookTypeLabel: string },
) {
  sheet.mergeCells(1, 1, 1, 8)
  sheet.getCell("A1").value = title
  sheet.getCell("A1").font = { bold: true, size: 12, color: { argb: "FF0F3D2E" } }
  sheet.getCell("A2").value = `Ejercicio: ${params.year}`
  sheet.getCell("A3").value = `NIF: ${params.nif}`
  sheet.getCell("A4").value = params.bookTypeLabel
  sheet.getCell("A5").value = `NOMBRE O RAZÓN SOCIAL: ${params.name}`
}

function emptyIfBlank(value: string | number): string | number | undefined {
  if (value === "" || value === undefined || value === null) return undefined
  return value
}

function issuedValues(row: IssuedLibrosRow): Array<string | number | undefined> {
  return [
    row.ejercicio,
    row.periodo,
    row.actividadCodigo,
    row.actividadTipo,
    emptyIfBlank(row.epigrafe),
    row.tipoFactura,
    emptyIfBlank(row.conceptoIngreso),
    emptyIfBlank(row.ingresoComputable),
    emptyIfBlank(row.fechaExpedicion),
    emptyIfBlank(row.fechaOperacion),
    emptyIfBlank(row.serie),
    emptyIfBlank(row.numero),
    undefined,
    emptyIfBlank(row.nifTipo),
    emptyIfBlank(row.nifPais),
    emptyIfBlank(row.nifIdentificacion),
    emptyIfBlank(row.nombreDestinatario),
    emptyIfBlank(row.claveOperacion),
    emptyIfBlank(row.calificacion),
    emptyIfBlank(row.operacionExenta),
    row.totalFactura,
    row.baseImponible,
    row.tipoIva,
    row.cuotaIva,
    emptyIfBlank(row.tipoRecargo),
    emptyIfBlank(row.cuotaRecargo),
    undefined,
    undefined,
    undefined,
    undefined,
    emptyIfBlank(row.tipoRetencion),
    emptyIfBlank(row.importeRetenido),
    undefined,
    undefined,
    undefined,
    emptyIfBlank(row.referenciaExterna),
  ]
}

function receivedValues(row: ReceivedLibrosRow): Array<string | number | undefined> {
  return [
    row.ejercicio,
    row.periodo,
    row.actividadCodigo,
    row.actividadTipo,
    emptyIfBlank(row.epigrafe),
    row.tipoFactura,
    emptyIfBlank(row.conceptoGasto),
    emptyIfBlank(row.gastoDeducible),
    emptyIfBlank(row.fechaExpedicion),
    emptyIfBlank(row.fechaOperacion),
    emptyIfBlank(row.serieNumero),
    undefined,
    emptyIfBlank(row.fechaRecepcion),
    undefined,
    undefined,
    emptyIfBlank(row.nifTipo),
    emptyIfBlank(row.nifPais),
    emptyIfBlank(row.nifIdentificacion),
    emptyIfBlank(row.nombreExpedidor),
    emptyIfBlank(row.claveOperacion),
    row.bienInversion,
    row.inversionSujetoPasivo,
    row.deduciblePeriodoPosterior,
    undefined,
    undefined,
    row.totalFactura,
    row.baseImponible,
    row.tipoIva,
    row.cuotaIva,
    row.cuotaDeducible,
    emptyIfBlank(row.tipoRecargo),
    emptyIfBlank(row.cuotaRecargo),
    undefined,
    undefined,
    undefined,
    undefined,
    emptyIfBlank(row.tipoRetencion),
    emptyIfBlank(row.importeRetenido),
    undefined,
    undefined,
    undefined,
    emptyIfBlank(row.referenciaExterna),
  ]
}

export async function generateLibrosRegistroXlsx(params: {
  year: number
  companyName: string
  companyCif: string
  books: LibrosRegistroBooks
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Barna Gestoría"
  workbook.company = params.companyName

  const issued = workbook.addWorksheet("EXPEDIDAS_INGRESOS")
  writeMeta(issued, "LIBRO REGISTRO FACTURAS EXPEDIDAS Y LIBRO REGISTRO DE VENTAS E INGRESOS", {
    year: params.year,
    nif: params.companyCif,
    name: params.companyName,
    bookTypeLabel:
      "@ (Tipo de Libro Registro): U (Unificado de Facturas Emitidas -IVA- y de Ventas e Ingresos -IRPF-)",
  })
  issued.getRow(7).values = ISSUED_GROUP_HEADERS
  const issuedHeader = issued.getRow(8)
  issuedHeader.values = ISSUED_HEADERS
  styleHeader(issuedHeader)
  params.books.issued.forEach((row, index) => {
    issued.getRow(11 + index).values = issuedValues(row)
  })

  const received = workbook.addWorksheet("RECIBIDAS_GASTOS")
  writeMeta(received, "LIBRO REGISTRO FACTURAS RECIBIDAS Y LIBRO REGISTRO DE COMPRAS Y GASTOS", {
    year: params.year,
    nif: params.companyCif,
    name: params.companyName,
    bookTypeLabel:
      "@ (Tipo de Libro Registro): V (Unificado de Facturas Recibidas -IVA- y de Compras y Gastos -IRPF-)",
  })
  received.getRow(7).values = RECEIVED_GROUP_HEADERS
  const receivedHeader = received.getRow(8)
  receivedHeader.values = RECEIVED_HEADERS
  styleHeader(receivedHeader)
  params.books.received.forEach((row, index) => {
    received.getRow(11 + index).values = receivedValues(row)
  })

  const investment = workbook.addWorksheet("BIENES-INVERSIÓN")
  writeMeta(investment, "LIBRO REGISTRO DE BIENES DE INVERSIÓN", {
    year: params.year,
    nif: params.companyCif,
    name: params.companyName,
    bookTypeLabel: "@ (Tipo de Libro Registro): W (Unificado de Bienes de Inversión del IVA y del IRPF)",
  })
  const investmentHeader = investment.getRow(8)
  investmentHeader.values = INVESTMENT_HEADERS
  styleHeader(investmentHeader)

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

export const LIBROS_REGISTRO_ISSUED_HEADERS = ISSUED_HEADERS
export const LIBROS_REGISTRO_RECEIVED_HEADERS = RECEIVED_HEADERS

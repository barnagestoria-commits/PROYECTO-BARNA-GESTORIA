/** Utilidades para construir registros SUENLACE de prueba (512 bytes). */

function pad(value: string, length: number): string {
  return value.slice(0, length).padEnd(length, " ")
}

export function buildSuenlaceRecord(fields: {
  company?: string
  fecha: string
  recordType: string
  cuenta: string
  cuentaDesc?: string
  dh?: "D" | "H" | "A"
  documento?: string
  lineMarker?: "I" | "M" | "U" | " "
  concepto: string
  importe: string
}): string {
  let record = ""
  record += "5"
  record += pad(fields.company ?? "00001", 5)
  record += fields.fecha
  record += fields.recordType
  record += pad(fields.cuenta, 12)
  record += pad(fields.cuentaDesc ?? "", 30)
  record += fields.dh ?? "D"
  record += pad(fields.documento ?? "", 10)
  record += fields.lineMarker ?? " "
  record += pad(fields.concepto, 30)
  record += pad(fields.importe, 14)
  record = record.padEnd(508, " ")
  record += "E"
  record += "N"
  record += "\r\n"
  return record.slice(0, 512)
}

export function buildSubaccountRecord(
  cuenta: string,
  name: string,
  options?: { company?: string; fecha?: string; nif?: string },
): string {
  let record = ""
  record += "5"
  record += pad(options?.company ?? "00001", 5)
  record += options?.fecha ?? "20250115"
  record += "C"
  record += pad(cuenta, 12)
  record += pad(name, 30)
  record += "N"
  record += pad("+0000000000.00", 14)
  record += " "
  if (options?.nif) {
    record = record.slice(0, 77) + pad(options.nif, 14) + record.slice(91)
  }
  record = record.padEnd(508, " ")
  record += "E"
  record += "N"
  record += "\r\n"
  return record.slice(0, 512)
}

/** Asiento equilibrado: gasto 629 + IVA 472 = proveedor 400 */
export function buildBalancedExpenseEntry(options?: {
  base?: number
  iva?: number
  gastoCuenta?: string
  proveedorCuenta?: string
}): string {
  const base = options?.base ?? 100
  const iva = options?.iva ?? 21
  const total = base + iva
  const gastoCuenta = options?.gastoCuenta ?? "629000000003"
  const proveedorCuenta = options?.proveedorCuenta ?? "400000000523"
  const fecha = "20250115"
  const fmt = (n: number) => `+${n.toFixed(2).padStart(13, "0")}`

  return (
    buildSuenlaceRecord({
      fecha,
      recordType: "0",
      cuenta: gastoCuenta,
      cuentaDesc: "SERVICIOS",
      dh: "D",
      documento: "FRA001",
      lineMarker: "I",
      concepto: "Gasto servicios enero",
      importe: fmt(base),
    }) +
    buildSuenlaceRecord({
      fecha,
      recordType: "0",
      cuenta: "472000000001",
      cuentaDesc: "IVA SOPORTADO",
      dh: "D",
      documento: "FRA001",
      lineMarker: "M",
      concepto: "IVA soportado",
      importe: fmt(iva),
    }) +
    buildSuenlaceRecord({
      fecha,
      recordType: "0",
      cuenta: proveedorCuenta,
      cuentaDesc: "PROVEEDOR SL",
      dh: "H",
      documento: "FRA001",
      lineMarker: "U",
      concepto: "Proveedor SL",
      importe: fmt(total),
    })
  )
}

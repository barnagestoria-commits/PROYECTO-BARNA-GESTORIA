/**
 * Generador mínimo de registros SUENLACE v9.50 (512 bytes) para pruebas locales.
 * Ejecutar: npx tsx scripts/test-a3-parser.ts
 */
import JSZip from "jszip"
import { parseA3ZipBuffer } from "../lib/imports/a3/parse-a3-zip"

function pad(value: string, length: number): string {
  return value.slice(0, length).padEnd(length, " ")
}

function buildRecord(fields: {
  company: string
  fecha: string
  recordType: string
  cuenta: string
  cuentaDesc: string
  dh: "D" | "H"
  documento: string
  lineMarker: "I" | "M" | "U"
  concepto: string
  importe: string
}): string {
  let record = ""
  record += "5"
  record += pad(fields.company, 5)
  record += fields.fecha
  record += fields.recordType
  record += pad(fields.cuenta, 12)
  record += pad(fields.cuentaDesc, 30)
  record += fields.dh
  record += pad(fields.documento, 10)
  record += fields.lineMarker
  record += pad(fields.concepto, 30)
  record += pad(fields.importe, 14)
  record = record.padEnd(508, " ")
  record += "E"
  record += "N"
  record += "\r\n"
  return record.slice(0, 512)
}

function buildSubaccountRecord(company: string, fecha: string, cuenta: string, name: string): string {
  let record = ""
  record += "5"
  record += pad(company, 5)
  record += fecha
  record += "C"
  record += pad(cuenta, 12)
  record += pad(name, 30)
  record += "N"
  record += pad("+0000000000.00", 14)
  record += " "
  record = record.padEnd(508, " ")
  record += "E"
  record += "N"
  record += "\r\n"
  return record.slice(0, 512)
}

async function main() {
  const company = "00001"
  const fecha = "20250115"

  const asientDat =
    buildRecord({
      company,
      fecha,
      recordType: "0",
      cuenta: "572000000001",
      cuentaDesc: "BANCO PRINCIPAL",
      dh: "D",
      documento: "AS0001",
      lineMarker: "I",
      concepto: "Cobro factura enero",
      importe: "+0000000500.00",
    }) +
    buildRecord({
      company,
      fecha,
      recordType: "0",
      cuenta: "430000000001",
      cuentaDesc: "CLIENTE DEMO SL",
      dh: "H",
      documento: "AS0001",
      lineMarker: "U",
      concepto: "Cobro factura enero",
      importe: "+0000000500.00",
    })

  const subcueDat = buildSubaccountRecord(company, fecha, "629000000003", "SERVICIOS VARIOS")

  const subcuentTxt = "629000000003SERVICIOS VARIOS              \n"

  const zip = new JSZip()
  zip.file("ASIENT.DAT", asientDat, { binary: true })
  zip.file("SUBCUE.DAT", subcueDat, { binary: true })
  zip.file("SUBCUENT.TXT", subcuentTxt)
  zip.file("VERSION.TXT", "a3ASESOR eco 9.50")

  const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }))

  const preview = await parseA3ZipBuffer(buffer, "demo-2025.zip")

  console.log("Preview:", {
    version: preview.versionLabel,
    companyCode: preview.companyCode,
    fiscalYear: preview.fiscalYear,
    entries: preview.entryCount,
    subaccounts: preview.subaccountCount,
    recordTypes: preview.recordTypes,
    files: preview.contents.fileNames,
  })

  if (preview.entryCount !== 1 || preview.subaccountCount < 1) {
    throw new Error("Parser A3 no detectó los datos esperados.")
  }

  console.log("OK — parser A3 validado.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

import https from "node:https"
import { URL } from "node:url"
import { siiEndpoint, siiSoapAction } from "@/lib/fiscal/sii/xml"
import type { SiiBook } from "@/lib/fiscal/sii/types"

export interface SiiLineResult {
  numero: string
  fecha: string
  status: "ACEPTADA" | "RECHAZADA"
  csv: string | null
  errorCode: string | null
  errorMessage: string | null
}

function readTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<(?:\\w+:)?${tag}>([^<]*)</(?:\\w+:)?${tag}>`))
  return match?.[1]?.trim() ?? ""
}

export function parseSiiResponse(xml: string): { envelopeStatus: string; lines: SiiLineResult[]; fault: string | null } {
  const fault = readTag(xml, "faultstring")
  const envelopeStatus = readTag(xml, "EstadoEnvio")
  const lines: SiiLineResult[] = []
  const chunks = xml.split(/<(?:\w+:)?RespuestaLinea>/).slice(1)
  for (const chunk of chunks) {
    const block = chunk.split(/<\/(?:\w+:)?RespuestaLinea>/)[0] ?? chunk
    const estado = readTag(block, "EstadoRegistro")
    lines.push({
      numero: readTag(block, "NumSerieFacturaEmisor"),
      fecha: readTag(block, "FechaExpedicionFacturaEmisor"),
      status: estado === "Correcto" || estado === "AceptadoConErrores" ? "ACEPTADA" : "RECHAZADA",
      csv: readTag(block, "CSV") || null,
      errorCode: readTag(block, "CodigoErrorRegistro") || null,
      errorMessage: readTag(block, "DescripcionErrorRegistro") || null,
    })
  }
  return { envelopeStatus, lines, fault: fault || null }
}

export function postSiiSoap(params: {
  book: SiiBook
  environment: "sandbox" | "production"
  xml: string
  pfx: Buffer
  passphrase: string
}): Promise<string> {
  const endpoint = new URL(siiEndpoint(params.book, params.environment))
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        protocol: endpoint.protocol,
        hostname: endpoint.hostname,
        path: endpoint.pathname,
        method: "POST",
        pfx: params.pfx,
        passphrase: params.passphrase,
        headers: {
          "Content-Type": "text/xml; charset=UTF-8",
          SOAPAction: `"${siiSoapAction(params.book)}"`,
          "Content-Length": Buffer.byteLength(params.xml),
        },
        timeout: 30000,
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
        response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
      },
    )
    request.on("timeout", () => {
      request.destroy(new Error("Hacienda no ha respondido al envío del SII."))
    })
    request.on("error", (error) => {
      reject(error instanceof Error ? error : new Error("No se ha podido conectar con el SII."))
    })
    request.write(params.xml)
    request.end()
  })
}

import { Readable } from "node:stream"
import JSZip from "jszip"
import { prisma } from "@/lib/db"
import { exportAccountingEntries } from "@/lib/exports/accounting-export"
import { getStoredObject } from "@/lib/storage/object-storage"

/** Tope de archivos originales (facturas, extractos) dentro del ZIP, para no agotar la memoria de la función. */
const MAX_ORIGINAL_FILES_BYTES = 150 * 1024 * 1024

function safeName(value: string, fallback: string): string {
  const cleaned = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80)
  return cleaned || fallback
}

/** JSON legible. Fechas y decimales salen como texto; las rutas internas de almacenamiento no se incluyen. */
function toJson(value: unknown): string {
  return JSON.stringify(
    value,
    (key, item) => {
      if (key === "storageKey") return undefined
      if (typeof item === "bigint") return item.toString()
      return item
    },
    2,
  )
}

const README = [
  "COPIA DE TUS DATOS DE TAXLYN",
  "============================",
  "",
  "Este archivo contiene toda la información de tu cuenta en formato abierto, para que puedas conservarla o llevarla a otro programa.",
  "",
  "cuenta.json                  Datos de la cuenta y de sus usuarios.",
  "empresas/<empresa>/",
  "  empresa.json               Datos de la empresa.",
  "  diario.csv                 Libro diario (asientos) en CSV, listo para abrir en Excel.",
  "  datos/*.json               Asientos con sus apuntes, terceros, subcuentas, movimientos bancarios, activos fijos y demás datos.",
  "  documentos/                Facturas y documentos originales que subiste.",
  "  extractos/                 Extractos bancarios originales que subiste.",
  "",
  "Los archivos .json se abren con cualquier editor de texto. Los importes y las fechas van como texto.",
  "Si falta algo o necesitas ayuda para importarlo en otro programa, escríbenos a infotaxlyn@gmail.com.",
  "",
].join("\n")

/**
 * ZIP con todos los datos de la cuenta. Se genera en streaming: la respuesta no pasa por el límite
 * de 4,5 MB de las funciones de Vercel, que solo aplica a respuestas que no se emiten por partes.
 */
export async function createAccountExportStream(accountId: string): Promise<ReadableStream<Uint8Array>> {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    select: {
      id: true,
      name: true,
      accountType: true,
      createdAt: true,
      users: { select: { name: true, email: true, role: true, createdAt: true } },
      companies: { orderBy: { createdAt: "asc" } },
    },
  })

  const zip = new JSZip()
  zip.file("LEEME.txt", README)
  zip.file(
    "cuenta.json",
    toJson({
      nombre: account.name,
      tipo: account.accountType,
      creadaEl: account.createdAt,
      usuarios: account.users,
      exportadaEl: new Date(),
    }),
  )

  const notIncluded: string[] = []
  let originalBytes = 0

  for (const company of account.companies) {
    const companyId = company.id
    const folder = `empresas/${safeName(company.name, "empresa")}-${companyId.slice(-6)}`

    zip.file(`${folder}/empresa.json`, toJson(company))

    try {
      const diary = await exportAccountingEntries({ companyId, sourceFormat: "generic" })
      zip.file(`${folder}/diario.csv`, diary.csv.content)
    } catch (error) {
      console.error(`[taxlyn] Exportación: no se pudo generar el diario de ${companyId}.`, error)
    }

    const tables: Array<[string, () => Promise<unknown>]> = [
      [
        "asientos",
        () =>
          prisma.accountingEntry.findMany({
            where: { companyId },
            orderBy: { refNumber: "asc" },
            include: { lines: { orderBy: { sortOrder: "asc" } } },
          }),
      ],
      ["terceros", () => prisma.thirdParty.findMany({ where: { companyId } })],
      ["subcuentas", () => prisma.ledgerSubaccount.findMany({ where: { companyId } })],
      ["movimientos-bancarios", () => prisma.bankMovement.findMany({ where: { companyId } })],
      ["extractos-importados", () => prisma.bankStatementImport.findMany({ where: { companyId } })],
      ["documentos", () => prisma.fiscalDocument.findMany({ where: { companyId } })],
      ["declaraciones", () => prisma.fiscalDeclaration.findMany({ where: { companyId } })],
      ["activos-fijos", () => prisma.fixedAsset.findMany({ where: { companyId } })],
      ["centros-de-coste", () => prisma.costCenter.findMany({ where: { companyId } })],
      ["ajustes-fiscales", () => prisma.companyFiscalSettings.findMany({ where: { companyId } })],
      ["ajustes-contables", () => prisma.companyAccountingSettings.findMany({ where: { companyId } })],
      ["tratamiento-de-cuentas", () => prisma.accountTreatmentConfig.findMany({ where: { companyId } })],
      ["amortizaciones", () => prisma.amortizationRun.findMany({ where: { companyId } })],
    ]

    for (const [name, load] of tables) {
      const rows = await load()
      if (Array.isArray(rows) && rows.length === 0) continue
      zip.file(`${folder}/datos/${name}.json`, toJson(rows))
    }

    // Archivos originales: facturas/documentos y extractos bancarios.
    const documents = await prisma.fiscalDocument.findMany({
      where: { companyId, storageKey: { not: null } },
      select: { id: true, name: true, storageKey: true, sizeBytes: true },
    })
    const statements = await prisma.bankStatementImport.findMany({
      where: { companyId, storageKey: { not: null } },
      select: { id: true, fileName: true, storageKey: true },
    })

    const originals = [
      ...documents.map((doc) => ({ dir: "documentos", id: doc.id, name: doc.name, key: doc.storageKey!, size: doc.sizeBytes })),
      ...statements.map((item) => ({ dir: "extractos", id: item.id, name: item.fileName, key: item.storageKey!, size: 0 })),
    ]

    for (const file of originals) {
      const label = `${folder}/${file.dir}/${file.id.slice(-6)}-${safeName(file.name, "archivo")}`
      if (originalBytes + file.size > MAX_ORIGINAL_FILES_BYTES) {
        notIncluded.push(label)
        continue
      }
      try {
        const body = await getStoredObject(file.key)
        if (originalBytes + body.length > MAX_ORIGINAL_FILES_BYTES) {
          notIncluded.push(label)
          continue
        }
        originalBytes += body.length
        zip.file(label, body)
      } catch (error) {
        console.error(`[taxlyn] Exportación: no se pudo leer el archivo ${file.key}.`, error)
        notIncluded.push(label)
      }
    }
  }

  if (notIncluded.length > 0) {
    zip.file(
      "ARCHIVOS-NO-INCLUIDOS.txt",
      [
        "Estos archivos originales no han cabido en la descarga o no se han podido leer.",
        "Escríbenos a infotaxlyn@gmail.com y te los enviamos aparte.",
        "",
        ...notIncluded,
        "",
      ].join("\n"),
    )
  }

  const nodeStream = zip.generateNodeStream({
    type: "nodebuffer",
    streamFiles: true,
    compression: "DEFLATE",
  }) as unknown as Readable
  return Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>
}

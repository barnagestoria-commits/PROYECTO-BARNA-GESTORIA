import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces"
import { formatEuro } from "@/lib/reports/format"
import type { InvoicePdfData, InvoiceTableStyle } from "@/lib/invoices/types"

const GRAPHITE = "#2C2C2C"
const MUTED = "#6B7280"
const BORDER = "#E5E7EB"

function partyBlock(
  title: string,
  name: string,
  taxId: string,
  addressLines: string[],
  contact?: { email?: string; phone?: string },
): Content {
  const stack: Content[] = [
    { text: title, style: "blockTitle" },
    { text: name, style: "partyName" },
    { text: `NIF/CIF: ${taxId}`, style: "partyMeta" },
    ...addressLines.map((line) => ({ text: line, style: "partyMeta" })),
  ]
  if (contact?.email) stack.push({ text: contact.email, style: "partyMeta" })
  if (contact?.phone) stack.push({ text: contact.phone, style: "partyMeta" })
  return { stack, width: "*" } as Content
}

function tableHeaderFill(style: InvoiceTableStyle, primary: string): string | null {
  if (style === "minimal") return null
  return primary
}

function tableFillColor(rowIndex: number, rowCount: number, style: InvoiceTableStyle, primary: string): string | null {
  if (rowIndex === 0) return tableHeaderFill(style, primary)
  if (style === "striped" && rowIndex % 2 === 0) return "#F9FAFB"
  if (rowIndex === rowCount - 1) return null
  return null
}

function tableLayout(style: InvoiceTableStyle, rowCount: number, primary: string) {
  return {
    hLineWidth: () => (style === "minimal" ? 0.3 : 0.5),
    vLineWidth: () => 0,
    hLineColor: () => BORDER,
    paddingLeft: () => 6,
    paddingRight: () => 6,
    paddingTop: () => 5,
    paddingBottom: () => 5,
    fillColor: (rowIndex: number) => tableFillColor(rowIndex, rowCount, style, primary),
  }
}

function lineItemsTable(data: InvoicePdfData): Content {
  const template = data.template
  const headerStyle = template.tableStyle === "minimal" ? "tableHeaderMinimal" : "tableHeader"
  const showDiscount =
    template.visibility.showZeroDiscounts ||
    data.lineItems.some((line) => line.discountPercent > 0)

  const header: TableCell[] = [
    { text: "Concepto", style: headerStyle },
    { text: "Cant.", style: headerStyle, alignment: "right" },
    { text: "P. unit.", style: headerStyle, alignment: "right" },
  ]
  if (showDiscount) header.push({ text: "Dto.", style: headerStyle, alignment: "right" })
  header.push(
    { text: "Base", style: headerStyle, alignment: "right" },
    { text: "IVA", style: headerStyle, alignment: "right" },
    { text: "Total", style: headerStyle, alignment: "right" },
  )

  const body: TableCell[][] = [header]
  for (const line of data.lineItems) {
    if (!template.visibility.showZeroDiscounts && line.discountPercent === 0 && line.base === 0) {
      continue
    }
    const row: TableCell[] = [
      { text: line.description, style: "tableCell" },
      { text: String(line.quantity), alignment: "right", style: "tableCell" },
      { text: formatEuro(line.unitPrice), alignment: "right", style: "tableCell" },
    ]
    if (showDiscount) {
      row.push({
        text: line.discountPercent ? `${line.discountPercent}%` : "—",
        alignment: "right",
        style: "tableCell",
      })
    }
    row.push(
      { text: formatEuro(line.base), alignment: "right", style: "tableCell" },
      { text: `${line.vatPercent}%`, alignment: "right", style: "tableCell" },
      { text: formatEuro(line.total), alignment: "right", style: "tableCellBold" },
    )
    body.push(row)
  }

  const widths = showDiscount ? ["*", 28, 52, 32, 52, 32, 58] : ["*", 28, 52, 52, 32, 58]

  return {
    table: { headerRows: 1, widths, body },
    layout: tableLayout(template.tableStyle, body.length, template.primaryColor),
    margin: [0, 0, 0, 12],
  }
}

function totalsBlock(data: InvoicePdfData): Content {
  const rows: TableCell[][] = [
    [
      { text: "Base imponible", style: "totalsLabel" },
      { text: formatEuro(data.subtotal), alignment: "right", style: "totalsValue" },
    ],
    ...data.taxBreakdown.map((row) => [
      { text: `IVA ${row.vatPercent}%`, style: "totalsLabel" },
      { text: formatEuro(row.quota), alignment: "right", style: "totalsValue" },
    ] as TableCell[]),
  ]
  if (data.totalIrpf > 0) {
    rows.push([
      { text: "Retención IRPF", style: "totalsLabel" },
      { text: `-${formatEuro(data.totalIrpf)}`, alignment: "right", style: "totalsValue" },
    ])
  }
  rows.push([
    { text: "TOTAL FACTURA", style: "totalsGrand" },
    { text: formatEuro(data.grandTotal), alignment: "right", style: "totalsGrand" },
  ])

  return {
    columns: [
      { width: "*", text: "" },
      {
        width: 220,
        table: {
          widths: ["*", 80],
          body: rows,
        },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
            i === node.table.body.length ? 1 : 0.3,
          vLineWidth: () => 0,
          hLineColor: () => BORDER,
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
    ],
  }
}

export function buildInvoicePdfDocument(
  data: InvoicePdfData,
  qrDataUrl?: string,
): TDocumentDefinitions {
  const template = data.template
  const { primaryColor, accentColor } = template
  const logoBlock: Content | null = template.logoDataUrl
    ? { image: template.logoDataUrl, width: 110, margin: [0, 0, 0, 8] }
    : null

  const content: Content[] = [
    {
      columns: [
        {
          width: "*",
          stack: [
            logoBlock || { text: data.issuer.name, style: "brandFallback" },
            data.registroMercantilLine
              ? { text: data.registroMercantilLine, style: "registroMercantil", margin: [0, 4, 0, 0] }
              : { text: "" },
          ],
        },
        {
          width: "auto",
          alignment: "right",
          stack: [
            { text: data.isRectificativa ? "FACTURA RECTIFICATIVA" : "FACTURA", style: "docTitle" },
            { text: `Nº ${data.invoiceNumber}`, style: "docNumber" },
            { text: `Fecha: ${formatDateEs(data.issueDate)}`, style: "docMeta" },
            { text: `Operación: ${formatDateEs(data.operationDate)}`, style: "docMeta" },
          ],
        },
      ],
      margin: [0, 0, 0, 10],
    },
    {
      canvas: [{ type: "rect", x: 0, y: 0, w: 515, h: 2, color: primaryColor }],
      margin: [0, 0, 0, 14],
    },
    {
      columns: [
        partyBlock("Emisor", data.issuer.name, data.issuer.taxId, data.issuer.address.lines, {
          email: data.issuer.address.email,
          phone: data.issuer.address.phone,
        }),
        partyBlock("Cliente", data.recipient.name, data.recipient.taxId, data.recipient.address.lines),
      ],
      columnGap: 20,
      margin: [0, 0, 0, 16],
    },
    lineItemsTable(data),
    totalsBlock(data),
  ]

  if (data.payment) {
    const paymentLines = [
      data.payment.paymentMethod,
      data.payment.iban ? `IBAN: ${data.payment.iban}` : null,
      data.payment.bankName ? data.payment.bankName : null,
      data.payment.dueDate ? `Vencimiento: ${formatDateEs(data.payment.dueDate)}` : null,
    ].filter(Boolean) as string[]

    content.push({
      stack: [
        { text: "Datos de pago", style: "sectionTitle" },
        ...paymentLines.map((line) => ({ text: line, style: "paymentLine" })),
      ],
      margin: [0, 8, 0, 8],
    })
  }

  if (data.notes) {
    content.push({
      text: data.notes,
      style: "footerNotes",
      margin: [0, 6, 0, 10],
    })
  }

  if (data.verifactu && qrDataUrl) {
    content.push({
      columns: [
        {
          width: 90,
          image: qrDataUrl,
          fit: [84, 84],
        },
        {
          width: "*",
          stack: [
            { text: "Verificación Veri*factu", style: "sectionTitle", margin: [0, 0, 0, 4] },
            { text: data.verifactu.qrCaption, style: "verifactuCaption" },
            {
              text: data.verifactu.verificationUrl,
              style: "verifactuUrl",
              link: data.verifactu.verificationUrl,
            },
            data.verifactu.recordHash
              ? { text: `Huella: ${data.verifactu.recordHash}`, style: "verifactuHash", margin: [0, 4, 0, 0] }
              : { text: "" },
          ],
          margin: [8, 4, 0, 0],
        },
      ],
      margin: [0, 10, 0, 0],
    })
  }

  return {
    pageSize: "A4",
    pageMargins: [40, 42, 40, 48],
    defaultStyle: { font: "Roboto", fontSize: 9, color: GRAPHITE },
    content,
    styles: {
      brandFallback: { fontSize: 14, bold: true, color: accentColor },
      registroMercantil: { fontSize: 7, color: MUTED, italics: true },
      docTitle: { fontSize: 18, bold: true, color: accentColor, alignment: "right" },
      docNumber: { fontSize: 11, bold: true, alignment: "right", margin: [0, 2, 0, 0] },
      docMeta: { fontSize: 8, color: MUTED, alignment: "right", margin: [0, 1, 0, 0] },
      blockTitle: { fontSize: 8, bold: true, color: primaryColor, margin: [0, 0, 0, 4] },
      partyName: { fontSize: 10, bold: true, margin: [0, 0, 0, 2] },
      partyMeta: { fontSize: 8, color: MUTED, margin: [0, 1, 0, 0] },
      sectionTitle: { fontSize: 9, bold: true, color: accentColor },
      tableHeader: { bold: true, color: "#FFFFFF", fontSize: 8 },
      tableHeaderMinimal: { bold: true, color: accentColor, fontSize: 8 },
      tableCell: { fontSize: 8 },
      tableCellBold: { fontSize: 8, bold: true },
      totalsLabel: { fontSize: 8, color: MUTED },
      totalsValue: { fontSize: 8 },
      totalsGrand: { fontSize: 10, bold: true, color: accentColor },
      paymentLine: { fontSize: 8, margin: [0, 1, 0, 0] },
      footerNotes: { fontSize: 7, color: MUTED, italics: true },
      verifactuCaption: { fontSize: 7.5, color: GRAPHITE },
      verifactuUrl: { fontSize: 6.5, color: MUTED },
      verifactuHash: { fontSize: 6.5, color: MUTED, characterSpacing: 0.2 },
    },
  }
}

function formatDateEs(isoDate: string): string {
  const value = isoDate.includes("T") ? isoDate.slice(0, 10) : isoDate
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return isoDate
  return `${day}/${month}/${year}`
}

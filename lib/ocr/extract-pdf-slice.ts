import { PDFDocument } from "pdf-lib"

export function clampPageRange(start: number, end: number, totalPages: number) {
  if (totalPages <= 0) {
    return { from: 1, to: 1 }
  }
  const from = Math.min(Math.max(1, Math.trunc(start) || 1), totalPages)
  const to = Math.min(Math.max(from, Math.trunc(end) || from), totalPages)
  return { from, to }
}

export async function slicePdfToBlob(
  bytes: ArrayBuffer,
  startPage: number,
  endPage: number,
): Promise<Blob> {
  const source = await PDFDocument.load(bytes)
  const totalPages = source.getPageCount()
  const { from, to } = clampPageRange(startPage, endPage, totalPages)
  const output = await PDFDocument.create()
  const indices = Array.from({ length: to - from + 1 }, (_, index) => from - 1 + index)
  const pages = await output.copyPages(source, indices)
  for (const page of pages) {
    output.addPage(page)
  }
  const pdfBytes = await output.save()
  const copy = new Uint8Array(pdfBytes.byteLength)
  copy.set(pdfBytes)
  return new Blob([copy], { type: "application/pdf" })
}

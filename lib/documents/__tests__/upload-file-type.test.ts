import { describe, expect, it } from "vitest"
import { isOcrMediaFile, isSpreadsheetFile } from "@/lib/documents/upload-file-type"

function fileNamed(name: string) {
  return { name } as File
}

describe("OCR upload file types", () => {
  it("accepts PDF and images for OCR", () => {
    expect(isOcrMediaFile(fileNamed("factura.pdf"))).toBe(true)
    expect(isOcrMediaFile(fileNamed("ticket.JPG"))).toBe(true)
    expect(isOcrMediaFile(fileNamed("scan.png"))).toBe(true)
    expect(isOcrMediaFile(fileNamed("diario.xlsx"))).toBe(false)
  })

  it("accepts Excel and CSV for accounting import", () => {
    expect(isSpreadsheetFile(fileNamed("diario.xlsx"))).toBe(true)
    expect(isSpreadsheetFile(fileNamed("asientos.csv"))).toBe(true)
    expect(isSpreadsheetFile(fileNamed("factura.pdf"))).toBe(false)
  })
})

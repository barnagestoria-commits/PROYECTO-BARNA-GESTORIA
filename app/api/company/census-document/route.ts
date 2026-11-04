import { NextResponse } from "next/server"
import { AuthApiError, authErrorResponse, resolveImportCompany } from "@/lib/auth/api-auth"
import { parseCensusDocumentText } from "@/lib/company/census-document"
import { extractTextFromPdf } from "@/lib/ocr/extract-pdf-text"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    await resolveImportCompany(request, formData)
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No se ha proporcionado ningún archivo." },
        { status: 400 },
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "El archivo supera el tamaño máximo de 10 MB." },
        { status: 400 },
      )
    }
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    if (!isPdf) {
      return NextResponse.json(
        { success: false, error: "Sube el PDF. Una foto o un escaneo de imagen no se puede contrastar." },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await extractTextFromPdf(buffer)
    const reading = parseCensusDocumentText(text)
    return NextResponse.json({ success: true, fileName: file.name, reading })
  } catch (error) {
    if (error instanceof AuthApiError) return authErrorResponse(error)
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}

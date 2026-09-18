import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { findDuplicateInvoiceEntry } from "@/lib/accounting/duplicate-invoice"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const { searchParams } = new URL(request.url)
    const documentTypeRaw = searchParams.get("documentType")
    const documentType =
      documentTypeRaw === "factura-emitida" ? "factura-emitida" : "factura-recibida"

    const duplicate = await findDuplicateInvoiceEntry({
      companyId,
      documentType,
      invoice: {
        cif: searchParams.get("cif") ?? "",
        numeroFactura: searchParams.get("numeroFactura") ?? "",
        fechaFactura: searchParams.get("fechaFactura") ?? "",
        total: Number(searchParams.get("total") ?? 0),
        accountCode: searchParams.get("accountCode") ?? undefined,
      },
    })

    return NextResponse.json({ success: true, duplicate })
  } catch (error) {
    return authErrorResponse(error)
  }
}

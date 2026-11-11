import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { deleteAccountingEntry } from "@/lib/accounting/entry-service"
import { prisma } from "@/lib/db"
import { deleteStoredObject } from "@/lib/storage/object-storage"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { companyId } = await requireActiveCompany(request)

    const document = await prisma.fiscalDocument.findFirst({
      where: { id, companyId },
      select: { id: true, accountingEntryId: true, storageKey: true },
    })

    if (!document) {
      return NextResponse.json({ success: false, error: "Documento no encontrado." }, { status: 404 })
    }

    if (document.accountingEntryId) {
      await deleteAccountingEntry(companyId, document.accountingEntryId)
    }

    await prisma.fiscalDocument.delete({
      where: { id: document.id },
    })
    await deleteStoredObject(document.storageKey)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}

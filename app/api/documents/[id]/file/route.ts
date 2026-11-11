import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { prisma } from "@/lib/db"
import { getStoredObject, sanitizeStorageFileName } from "@/lib/storage/object-storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { companyId } = await requireActiveCompany(request)

    const document = await prisma.fiscalDocument.findFirst({
      where: { id, companyId },
      select: { name: true, storageKey: true, contentType: true },
    })

    if (!document?.storageKey) {
      return NextResponse.json(
        { success: false, error: "Este documento no tiene el original en el almacén." },
        { status: 404 },
      )
    }

    const body = await getStoredObject(document.storageKey)
    const fileName = sanitizeStorageFileName(document.name)

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": document.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}

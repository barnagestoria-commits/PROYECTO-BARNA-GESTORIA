import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { resolveAccountParentCode } from "@/lib/accounting/new-account-prefix"
import {
  resolveOrCreateLedgerSubaccount,
} from "@/lib/accounting/ledger-subaccount-service"
import { upsertAccountTreatment } from "@/lib/accounting/account-treatment-service"
import type { AccountTreatmentConfigInput } from "@/lib/accounting/account-treatment-types"
import { ledgerSubaccountToOption } from "@/lib/accounting/ledger-subaccount-types"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const parentCode = url.searchParams.get("parentCode")?.trim() ?? ""

    const subaccounts = await prisma.ledgerSubaccount.findMany({
      where: {
        companyId,
        ...(parentCode ? { parentCode } : {}),
      },
      orderBy: [{ parentCode: "asc" }, { accountCode: "asc" }],
    })

    return NextResponse.json({
      success: true,
      subaccounts: subaccounts.map(ledgerSubaccountToOption),
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as {
      parentCode?: string
      name?: string
      notes?: string
      address?: string
      phone?: string
      email?: string
      treatment?: AccountTreatmentConfigInput
    }

    const parentCode = body.parentCode?.trim() ?? ""
    const meta = resolveAccountParentCode(parentCode)
    if (!meta || meta.isThirdParty) {
      return NextResponse.json(
        {
          success: false,
          error: "Prefijo de cuenta no válido. Usa cuentas del plan contable (p. ej. 678+, 629+).",
        },
        { status: 400 },
      )
    }

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: "El nombre de la subcuenta es obligatorio." },
        { status: 400 },
      )
    }

    const resolution = await resolveOrCreateLedgerSubaccount(companyId, meta.code, body.name, {
      notes: body.notes,
      address: body.address,
      phone: body.phone,
      email: body.email,
    })

    if (body.treatment) {
      await upsertAccountTreatment(companyId, resolution.accountCode, body.treatment)
    }

    return NextResponse.json({ success: true, resolution })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}

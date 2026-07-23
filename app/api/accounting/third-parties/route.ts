import { NextResponse } from "next/server"
import type { ThirdPartyType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import {
  isThirdPartyNewAccountPrefix,
  resolveAccountParentCode,
} from "@/lib/accounting/new-account-prefix"
import {
  resolveOrCreateThirdPartyWithPrefix,
} from "@/lib/accounting/third-party-service"
import { upsertAccountTreatment } from "@/lib/accounting/account-treatment-service"
import type { AccountTreatmentConfigInput } from "@/lib/accounting/account-treatment-types"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const typeParam = url.searchParams.get("type")

    const typeFilter =
      typeParam === "CLIENTE" || typeParam === "PROVEEDOR"
        ? (typeParam as ThirdPartyType)
        : undefined

    const thirdParties = await prisma.thirdParty.findMany({
      where: {
        companyId,
        ...(typeFilter ? { type: typeFilter } : {}),
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    })

    return NextResponse.json({
      success: true,
      thirdParties: thirdParties.map((party) => ({
        id: party.id,
        type: party.type,
        cif: party.cif,
        name: party.name,
        accountCode: party.accountCode,
        formattedAccountCode: formatAccountCodeDisplay(party.accountCode),
      })),
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as {
      accountPrefix?: string
      cif?: string
      name?: string
      treatment?: AccountTreatmentConfigInput
    }

    const accountPrefix = body.accountPrefix?.trim() ?? ""
    const meta = resolveAccountParentCode(accountPrefix)
    if (!meta?.isThirdParty || !isThirdPartyNewAccountPrefix(meta.code)) {
      return NextResponse.json(
        {
          success: false,
          error: "Prefijo de tercero no válido. Usa 430+, 400+ o 410+.",
        },
        { status: 400 },
      )
    }

    if (!body.cif?.trim() || !body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: "NIF y nombre son obligatorios." },
        { status: 400 },
      )
    }

    const resolution = await resolveOrCreateThirdPartyWithPrefix(
      companyId,
      meta.code,
      body.cif,
      body.name,
    )

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

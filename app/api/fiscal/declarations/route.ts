import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  clearFiscalDeclaration,
  isFiscalModelId,
  periodKeyToDeclarationQuarter,
  upsertFiscalDeclaration,
} from "@/lib/fiscal/fiscal-declaration-service"
import type { FiscalPeriodKey } from "@/lib/types/fiscal-panorama"
import type { FiscalDeclarationStatus } from "@prisma/client"

function parseStatus(value: unknown): FiscalDeclarationStatus | null {
  if (value === "pendiente" || value === "PENDIENTE") return "PENDIENTE"
  if (value === "presentado" || value === "PRESENTADO") return "PRESENTADO"
  if (value === "sin_datos" || value === "SIN_DATOS") return "SIN_DATOS"
  return null
}

export async function PUT(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as {
      modelCode?: string
      year?: number
      quarter?: number
      period?: FiscalPeriodKey
      status?: string
      notes?: string | null
      submittedAt?: string | null
    }

    const modelCode = body.modelCode?.trim()
    if (!modelCode || !isFiscalModelId(modelCode)) {
      return NextResponse.json({ success: false, error: "Modelo no válido." }, { status: 400 })
    }

    const year = Number(body.year)
    if (!Number.isFinite(year)) {
      return NextResponse.json({ success: false, error: "Ejercicio no válido." }, { status: 400 })
    }

    const quarter =
      body.quarter != null
        ? Number(body.quarter)
        : body.period
          ? periodKeyToDeclarationQuarter(body.period)
          : NaN
    if (!Number.isFinite(quarter)) {
      return NextResponse.json({ success: false, error: "Periodo no válido." }, { status: 400 })
    }

    const status = parseStatus(body.status)
    if (!status) {
      return NextResponse.json({ success: false, error: "Estado no válido." }, { status: 400 })
    }

    const declaration = await upsertFiscalDeclaration(companyId, {
      modelCode,
      year,
      quarter,
      status,
      notes: body.notes,
      submittedAt: body.submittedAt,
    })

    return NextResponse.json({ success: true, declaration })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const modelCode = url.searchParams.get("modelCode")?.trim()
    const year = Number.parseInt(url.searchParams.get("year") ?? "", 10)
    const quarterParam = url.searchParams.get("quarter")
    const period = url.searchParams.get("period") as FiscalPeriodKey | null

    if (!modelCode || !isFiscalModelId(modelCode)) {
      return NextResponse.json({ success: false, error: "Modelo no válido." }, { status: 400 })
    }
    if (!Number.isFinite(year)) {
      return NextResponse.json({ success: false, error: "Ejercicio no válido." }, { status: 400 })
    }

    const quarter =
      quarterParam != null
        ? Number.parseInt(quarterParam, 10)
        : period
          ? periodKeyToDeclarationQuarter(period)
          : NaN
    if (!Number.isFinite(quarter)) {
      return NextResponse.json({ success: false, error: "Periodo no válido." }, { status: 400 })
    }

    await clearFiscalDeclaration(companyId, modelCode, year, quarter)
    return NextResponse.json({ success: true })
  } catch (error) {
    return authErrorResponse(error)
  }
}
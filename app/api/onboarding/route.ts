import { NextResponse } from "next/server"
import { authErrorResponse, requireRequestSession } from "@/lib/auth/api-auth"
import { prisma } from "@/lib/db"
import { accountTypeToRoleProfile } from "@/lib/onboarding/types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const session = await requireRequestSession(request)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { hasCompletedOnboarding: true },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado." }, { status: 404 })
    }

    let hasFirstAccount = false
    if (session.activeCompanyId) {
      const [thirdParties, subaccounts] = await Promise.all([
        prisma.thirdParty.count({ where: { companyId: session.activeCompanyId } }),
        prisma.ledgerSubaccount.count({ where: { companyId: session.activeCompanyId } }),
      ])
      hasFirstAccount = thirdParties + subaccounts > 0
    }

    const roleProfile = accountTypeToRoleProfile(session.user.accountType)
    const recommendedStepIds: string[] = []
    // El certificado se valida en cliente (localStorage demo); el paso se recomienda por defecto
    recommendedStepIds.push("certificate")
    if (!hasFirstAccount) {
      recommendedStepIds.push("accounts")
    }

    return NextResponse.json({
      success: true,
      status: {
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        hasFirstAccount,
        recommendedStepIds,
        roleProfile,
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireRequestSession(request)
    const body = await request.json().catch(() => ({}))

    if (body.completed === true) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { hasCompletedOnboarding: true },
      })
    }

    if (body.completed === false) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { hasCompletedOnboarding: false },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return authErrorResponse(error)
  }
}

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/nextauth"
import { authErrorResponse } from "@/lib/auth/api-auth"
import { completeOAuthSignIn } from "@/lib/auth/oauth-service"

export async function POST() {
  try {
    const oauthSession = await getServerSession(authOptions)

    if (!oauthSession?.user?.email) {
      return NextResponse.json(
        { success: false, error: "No se pudo completar el inicio de sesión social." },
        { status: 401 },
      )
    }

    const session = await completeOAuthSignIn({
      email: oauthSession.user.email,
      name: oauthSession.user.name,
    })

    return NextResponse.json({ success: true, session })
  } catch (error) {
    return authErrorResponse(error)
  }
}

import { NextResponse } from "next/server"
import { getCurrentSession, logoutAccount } from "@/lib/auth/service"

export async function POST() {
  await logoutAccount()
  return NextResponse.json({ success: true })
}

export async function GET() {
  const session = await getCurrentSession()
  if (!session) {
    return NextResponse.json({ success: false, session: null }, { status: 401 })
  }
  return NextResponse.json({ success: true, session })
}

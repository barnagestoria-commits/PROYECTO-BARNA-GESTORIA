import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "ok" }, { status: 200 })
  } catch (error) {
    console.error("[healthcheck] Database ping failed:", error)
    return NextResponse.json({ status: "error" }, { status: 503 })
  }
}

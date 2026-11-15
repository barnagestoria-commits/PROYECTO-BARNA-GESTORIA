import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { runTrialLifecycle } from "@/lib/billing/trial-lifecycle"

export const runtime = "nodejs"
export const maxDuration = 300

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const received = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Vercel Cron llama aquí una vez al día (ver vercel.json) con `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: "CRON_SECRET no está configurado." }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 })
  }

  const summary = await runTrialLifecycle()
  return NextResponse.json({ success: true, ...summary })
}

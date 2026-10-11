import { prisma } from "@/lib/db"
import type { Model130Options } from "@/lib/fiscal/model-130"
import { decimalToNumber } from "@/lib/prisma/decimal"

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function signedNet(cuenta: string, debe: number, haber: number): number {
  const digits = cuenta.replace(/\D/g, "")
  if (digits.startsWith("7")) return round2(haber - debe)
  if (digits.startsWith("6")) return round2(debe - haber)
  return 0
}

export async function loadModel130Options(companyId: string, year: number): Promise<Model130Options> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { activityStartDate: true },
  })
  const activityStartDate = company?.activityStartDate
    ? company.activityStartDate.toISOString().slice(0, 10)
    : null
  const startYear = activityStartDate ? Number(activityStartDate.slice(0, 4)) : null

  let priorYearNetFromBooks: number | null = null
  if (startYear !== null && startYear < year) {
    const start = new Date(`${year - 1}-01-01T00:00:00.000Z`)
    const end = new Date(`${year - 1}-12-31T23:59:59.999Z`)
    const lines = await prisma.entryLine.findMany({
      where: { entry: { companyId, fecha: { gte: start, lte: end } } },
      select: { cuenta: true, debe: true, haber: true },
    })
    if (lines.length > 0) {
      priorYearNetFromBooks = round2(
        lines.reduce(
          (sum, line) => sum + signedNet(line.cuenta, decimalToNumber(line.debe), decimalToNumber(line.haber)),
          0,
        ),
      )
    }
  }

  return { activityStartDate, priorYearNetFromBooks }
}

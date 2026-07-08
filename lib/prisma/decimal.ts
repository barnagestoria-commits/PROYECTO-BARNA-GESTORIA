import type { Prisma } from "@prisma/client"

export function decimalToNumber(value: Prisma.Decimal | number | string): number {
  return typeof value === "number" ? value : Number(value)
}

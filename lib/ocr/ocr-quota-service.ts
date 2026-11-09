import { prisma } from "@/lib/db"
import { OcrQuotaError } from "@/lib/ocr/errors"
import {
  OCR_FREE_INVOICE_LIMIT,
  isOcrQuotaExhausted,
  ocrInvoiceUsage,
  type OcrInvoiceUsage,
} from "@/lib/ocr/ocr-quota"

export async function getOcrInvoiceUsage(accountId: string): Promise<OcrInvoiceUsage> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { ocrInvoiceCount: true },
  })

  return ocrInvoiceUsage(account?.ocrInvoiceCount ?? 0)
}

export async function assertOcrInvoiceQuota(accountId: string): Promise<OcrInvoiceUsage> {
  const usage = await getOcrInvoiceUsage(accountId)
  if (isOcrQuotaExhausted(usage.used, usage.limit)) {
    throw new OcrQuotaError()
  }
  return usage
}

export async function recordOcrInvoiceUsage(
  accountId: string,
  invoiceCount: number,
): Promise<OcrInvoiceUsage> {
  const increment = Math.max(0, Math.floor(invoiceCount))
  if (increment === 0) {
    return getOcrInvoiceUsage(accountId)
  }

  const account = await prisma.account.update({
    where: { id: accountId },
    data: { ocrInvoiceCount: { increment } },
    select: { ocrInvoiceCount: true },
  })

  return ocrInvoiceUsage(account.ocrInvoiceCount)
}

export { OCR_FREE_INVOICE_LIMIT }

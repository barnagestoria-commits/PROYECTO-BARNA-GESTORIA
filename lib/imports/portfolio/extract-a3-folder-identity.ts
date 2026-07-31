import type { A3Subaccount } from "@/lib/imports/a3/types"

function decodeLatin1(buffer: Buffer): string {
  return buffer.toString("latin1")
}

function padAccountCode(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length >= 12) return digits.slice(0, 12)
  return digits.padEnd(12, "0")
}

export function parseDaCuSubaccounts(buffer: Buffer): A3Subaccount[] {
  const text = decodeLatin1(buffer)
  const subaccounts: A3Subaccount[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(/(\d{3}\.\d{1,4})\s{1,3}([\x20-\x7E\u00C0-\u00FF]{4,40})/g)) {
    const accountCode = padAccountCode(match[1])
    const name = match[2].trim()
    if (!seen.has(accountCode)) {
      seen.add(accountCode)
      subaccounts.push({ accountCode, name })
    }
  }

  return subaccounts
}

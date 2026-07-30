import { normalizeAccountCode } from "@/lib/imports/a3/fixed-record"
import type { A3Subaccount } from "@/lib/imports/a3/types"

function parseFixedWidthLine(line: string): A3Subaccount | null {
  const trimmed = line.trimEnd()
  if (trimmed.length < 13) return null

  const accountCode = normalizeAccountCode(trimmed.slice(0, 12))
  const name = trimmed.slice(12, 42).trim() || trimmed.slice(12).trim()
  if (!accountCode || accountCode.length < 3 || !name) return null
  return { accountCode, name }
}

function parseDelimitedLine(line: string): A3Subaccount | null {
  const delimiter = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ","
  const parts = line.split(delimiter).map((part) => part.trim().replace(/^"|"$/g, ""))
  if (parts.length < 2) return null

  const accountCode = normalizeAccountCode(parts[0])
  const name = parts.slice(1).find((part) => part.length > 0) ?? ""
  if (!accountCode || accountCode.length < 3 || !name) return null
  return { accountCode, name }
}

export function parseSubcuentTxtContent(content: string): A3Subaccount[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)

  const subaccounts: A3Subaccount[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    const lower = line.toLowerCase()
    if (
      lower.startsWith("cuenta") ||
      lower.startsWith("codigo") ||
      lower.startsWith("código") ||
      lower.startsWith("subcuenta")
    ) {
      continue
    }

    const parsed =
      line.includes(";") || line.includes("\t") || line.includes(",")
        ? parseDelimitedLine(line)
        : parseFixedWidthLine(line)

    if (parsed && !seen.has(parsed.accountCode)) {
      seen.add(parsed.accountCode)
      subaccounts.push(parsed)
    }
  }

  return subaccounts
}

export function parseSubcuentTxtBuffer(buffer: Buffer): A3Subaccount[] {
  return parseSubcuentTxtContent(buffer.toString("latin1"))
}

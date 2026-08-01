import { decodeLatin1, type ImportBytes } from "@/lib/imports/a3/import-bytes"
import {
  decodeNativeNineDigitAccountField,
  decodeSnnsAccountField,
  padAccountCode12,
} from "@/lib/imports/a3/native-account-code"
import { normalizeVendorKey } from "@/lib/imports/a3/vendor-matching"
import type { A3Subaccount } from "@/lib/imports/a3/types"

const CU_MARKER = /\x10[\x04\xcc]/g

export interface NativePlanRegistry {
  subaccounts: A3Subaccount[]
  accountByVendorKey: Map<string, string>
  defaultExpenseAccount: string | null
  defaultIvaAccount: string | null
  defaultBankAccount: string | null
}

function cleanSubaccountName(raw: string): string {
  return raw
    .replace(/[^\x20-\x7E\u00C0-\u00FF].*$/, "")
    .replace(/^[^\wÁÉÍÓÚÑ]+/u, "")
    .trim()
    .slice(0, 60)
}

function pickNineDigitAccountField(preWindow: string): string | null {
  const candidates = preWindow.match(/\d{9}/g) ?? []
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const field = candidates[i]
    const middle = field.slice(3, 6)
    if (middle in { "400": 1, "430": 1, "629": 1, "472": 1, "572": 1, "640": 1, "849": 1, "505": 1 }) {
      return field
    }
  }
  return null
}

export function parseCuDatBinarySubaccounts(buffer: ImportBytes): A3Subaccount[] {
  const text = decodeLatin1(buffer)
  const subaccounts: A3Subaccount[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(CU_MARKER)) {
    const pos = match.index ?? 0
    const pre = text.slice(Math.max(0, pos - 70), pos)
    const field = pickNineDigitAccountField(pre)
    if (!field) continue

    const accountCode = decodeNativeNineDigitAccountField(field)
    if (!accountCode || seen.has(accountCode)) continue

    const after = text.slice(pos + 4, pos + 60)
    const nameMatch = after.match(/([A-ZÁÉÍÓÚÑ][\x20-\x7E\u00C0-\u00FF.,&\-]{3,40})/u)
    if (!nameMatch) continue

    const name = cleanSubaccountName(nameMatch[1])
    if (name.length < 4) continue

    seen.add(accountCode)
    subaccounts.push({ accountCode, name })
  }

  return subaccounts
}

export function parseAacDatSubaccounts(buffer: ImportBytes): A3Subaccount[] {
  const text = decodeLatin1(buffer)
  const subaccounts: A3Subaccount[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(/(400\d{9}|629\d{9}|472\d{9}|572\d{9})([\x20-\x7E\u00C0-\u00FF]{4,40})/g)) {
    const accountCode = match[1]
    const name = match[2].trim()
    if (!name || seen.has(accountCode)) continue
    seen.add(accountCode)
    subaccounts.push({ accountCode, name })
  }

  return subaccounts
}

export function parseDaCuDottedSubaccounts(buffer: ImportBytes): A3Subaccount[] {
  const text = decodeLatin1(buffer)
  const subaccounts: A3Subaccount[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(/(\d{3}\.\d{1,4})\s{1,3}([\x20-\x7E\u00C0-\u00FF]{4,40})/g)) {
    const accountCode = padAccountCode12(match[1])
    const name = match[2].trim()
    if (!name || seen.has(accountCode)) continue
    seen.add(accountCode)
    subaccounts.push({ accountCode, name })
  }

  for (const match of text.matchAll(/SNNS(\d{15})/g)) {
    const accountCode = decodeSnnsAccountField(match[1])
    if (!accountCode || seen.has(accountCode)) continue
    seen.add(accountCode)
    subaccounts.push({ accountCode, name: accountCode })
  }

  return subaccounts
}

export function buildNativePlanRegistry(subaccounts: A3Subaccount[]): NativePlanRegistry {
  const accountByVendorKey = new Map<string, string>()

  for (const sub of subaccounts) {
    const key = normalizeVendorKey(sub.name)
    if (!key || accountByVendorKey.has(key)) continue
    accountByVendorKey.set(key, sub.accountCode.replace(/\D/g, ""))
  }

  const expense =
    subaccounts.find((sub) => sub.accountCode.startsWith("849"))?.accountCode ??
    subaccounts.find((sub) => sub.accountCode.startsWith("629"))?.accountCode ??
    subaccounts.find((sub) => sub.accountCode.startsWith("505"))?.accountCode ??
    null

  const iva = subaccounts.find((sub) => sub.accountCode.startsWith("472"))?.accountCode ?? null
  const bank = subaccounts.find((sub) => sub.accountCode.startsWith("572"))?.accountCode ?? null

  return {
    subaccounts,
    accountByVendorKey,
    defaultExpenseAccount: expense,
    defaultIvaAccount: iva,
    defaultBankAccount: bank,
  }
}

export function lookupVendorAccount(registry: NativePlanRegistry, vendorName: string): string | null {
  const key = normalizeVendorKey(vendorName)
  if (!key) return null
  return registry.accountByVendorKey.get(key) ?? null
}

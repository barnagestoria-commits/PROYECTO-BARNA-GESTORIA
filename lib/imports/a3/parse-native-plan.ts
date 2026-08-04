import { decodeLatin1, type ImportBytes } from "@/lib/imports/a3/import-bytes"
import {
  decodeCu400ProviderSubaccount,
  decodeCuProviderNineDigitField,
  decodeNativeNineDigitAccountField,
  decodeSnnsAccountField,
  formatA3MerchandiseProviderAccount,
  formatA3ProviderAccount,
  isGarbagePlanRef,
  isProviderAccountCode,
  isValidPgcAccountCode,
  NINE_DIGIT_PGC_MIDDLE,
  padAccountCode12,
} from "@/lib/imports/a3/native-account-code"
import { normalizeVendorKey } from "@/lib/imports/a3/vendor-matching"
import type { A3Subaccount } from "@/lib/imports/a3/types"

const CU_RECORD_SIZE = 512
const CU_MARKERS = [/\x10[\x04\xcc]/g, /\x0f\xa0/g]

const PGC_MIDDLE_IN_NINE = NINE_DIGIT_PGC_MIDDLE

export interface NativePlanRegistry {
  subaccounts: A3Subaccount[]
  accountByVendorKey: Map<string, string>
  defaultExpenseAccount: string | null
  defaultIvaAccount: string | null
  defaultIvaRepercutidoAccount: string | null
  defaultBankAccount: string | null
  defaultSalesAccount: string | null
  defaultClientAccount: string | null
  defaultRetencionAccount: string | null
}

export type NativePlanDefaults = Partial<
  Pick<
    NativePlanRegistry,
    | "defaultExpenseAccount"
    | "defaultIvaAccount"
    | "defaultIvaRepercutidoAccount"
    | "defaultBankAccount"
    | "defaultSalesAccount"
    | "defaultClientAccount"
    | "defaultRetencionAccount"
  >
>

function cleanSubaccountName(raw: string): string {
  return raw
    .replace(/[\x00-\x08\x0B-\x1F].*$/, "")
    .replace(/^[^\wÁÉÍÓÚÑ]+/u, "")
    .trim()
    .slice(0, 60)
}

function readUInt16LE(buffer: ImportBytes, offset: number): number {
  return buffer[offset]! | (buffer[offset + 1]! << 8)
}

/** Resuelve la subcuenta de proveedor desde el registro binario CU.DAT (512 bytes). */
export function resolveCuProviderSubaccount(record: ImportBytes): number | null {
  if (record.length < 170) return null

  const u168 = readUInt16LE(record, 168)
  if (u168 > 0 && u168 <= 9999 && !isGarbagePlanRef(u168)) {
    return u168
  }

  const u156 = readUInt16LE(record, 156)
  if (u156 > 61 && u156 <= 9999 && !isGarbagePlanRef(u156)) {
    return u156 - 61
  }

  return null
}

function nineDigitFieldsInRecord(record: ImportBytes): string[] {
  const window = decodeLatin1(record.subarray(0, Math.min(record.length, 280)))
  return window.match(/\d{9}/g) ?? []
}

function resolveAccountFromCuRecord(record: ImportBytes): { accountCode: string; priority: number } | null {
  const providerSub = resolveCuProviderSubaccount(record)
  if (providerSub !== null) {
    return { accountCode: formatA3ProviderAccount(providerSub), priority: 4 }
  }

  const nineDigitFields = nineDigitFieldsInRecord(record)
  const has400Template = nineDigitFields.some((field) => field === "100400000")

  for (const field of nineDigitFields) {
    const middle = field.slice(3, 6)
    if (middle === "400" || middle === "410") {
      const fromProvider = decodeCuProviderNineDigitField(field)
      if (fromProvider && isProviderAccountCode(fromProvider)) {
        return { accountCode: fromProvider, priority: 3 }
      }
      continue
    }
    if (!PGC_MIDDLE_IN_NINE.has(middle)) continue
    const decoded = decodeNativeNineDigitAccountField(field)
    if (decoded && isProviderAccountCode(decoded)) {
      return { accountCode: decoded, priority: 2 }
    }
  }

  if (has400Template) {
    const merchandiseSub = decodeCu400ProviderSubaccount(record)
    if (merchandiseSub !== null) {
      return {
        accountCode: formatA3MerchandiseProviderAccount(merchandiseSub),
        priority: 3,
      }
    }
  }

  return null
}

export function parseCuDatBinarySubaccounts(buffer: ImportBytes): A3Subaccount[] {
  const text = decodeLatin1(buffer)
  const bestByVendor = new Map<string, { accountCode: string; name: string; priority: number }>()

  for (const marker of CU_MARKERS) {
    for (const match of text.matchAll(marker)) {
      const pos = match.index ?? 0
      const recordStart = Math.floor(pos / CU_RECORD_SIZE) * CU_RECORD_SIZE
      const record = buffer.subarray(recordStart, recordStart + CU_RECORD_SIZE)

      const resolved = resolveAccountFromCuRecord(record)
      if (!resolved || !isValidPgcAccountCode(resolved.accountCode)) continue

      const skip = match[0].length
      const after = text.slice(pos + skip, pos + skip + 60)
      const nameMatch = after.match(/([A-ZÁÉÍÓÚÑ][\x20-\x7E\u00C0-\u00FF.,&\-0-9]{3,45})/u)
      if (!nameMatch) continue

      const name = cleanSubaccountName(nameMatch[1])
      if (name.length < 4) continue

      const vendorKey = normalizeVendorKey(name)
      if (!vendorKey) continue

      const existing = bestByVendor.get(vendorKey)
      if (!existing || resolved.priority > existing.priority) {
        bestByVendor.set(vendorKey, { accountCode: resolved.accountCode, name, priority: resolved.priority })
      }
    }
  }

  return [...bestByVendor.values()].map(({ accountCode, name }) => ({ accountCode, name }))
}

export function parseAacDatSubaccounts(buffer: ImportBytes): A3Subaccount[] {
  const text = decodeLatin1(buffer)
  const subaccounts: A3Subaccount[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(/4100(\d{4})0{4}\s*([\x20-\x7E\u00C0-\u00FF]{4,40})/g)) {
    const accountCode = formatA3ProviderAccount(Number.parseInt(match[1], 10))
    const name = cleanSubaccountName(match[2])
    if (!name || seen.has(accountCode)) continue
    seen.add(accountCode)
    subaccounts.push({ accountCode, name })
  }

  for (const match of text.matchAll(/(400\d{9}|430\d{9}|629\d{9}|472\d{9}|572\d{9})([\x20-\x7E\u00C0-\u00FF]{4,40})/g)) {
    const accountCode = padAccountCode12(match[1])
    const name = cleanSubaccountName(match[2])
    if (!name || seen.has(accountCode)) continue
    seen.add(accountCode)
    subaccounts.push({ accountCode, name })
  }

  return subaccounts
}

export function parseTpPredefiDefaults(buffer: ImportBytes): NativePlanDefaults {
  const text = decodeLatin1(buffer)
  const pick = (pattern: RegExp): string | null => {
    const match = text.match(pattern)
    return match ? padAccountCode12(match[0]) : null
  }

  return {
    defaultExpenseAccount: pick(/60700000/),
    defaultIvaAccount: pick(/47200000/),
    defaultIvaRepercutidoAccount: pick(/47700000/),
    defaultBankAccount: pick(/57200002/) ?? pick(/57200000/),
    defaultRetencionAccount: pick(/47300000/),
    defaultSalesAccount: pick(/70500000/) ?? pick(/70000000/),
    defaultClientAccount: pick(/43000000/),
  }
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

function firstAccountPrefix(subaccounts: A3Subaccount[], prefix: string): string | null {
  const match = subaccounts.find((sub) => {
    const digits = sub.accountCode.replace(/\D/g, "")
    return digits.startsWith(prefix) && isValidPgcAccountCode(digits)
  })
  return match?.accountCode.replace(/\D/g, "") ?? null
}

export function buildNativePlanRegistry(
  subaccounts: A3Subaccount[],
  tpDefaults: NativePlanDefaults = {},
): NativePlanRegistry {
  const accountByVendorKey = new Map<string, string>()

  for (const sub of subaccounts) {
    const key = normalizeVendorKey(sub.name)
    if (!key || accountByVendorKey.has(key)) continue
    accountByVendorKey.set(key, sub.accountCode.replace(/\D/g, ""))
  }

  return {
    subaccounts,
    accountByVendorKey,
    defaultExpenseAccount:
      firstAccountPrefix(subaccounts, "607") ??
      tpDefaults.defaultExpenseAccount ??
      firstAccountPrefix(subaccounts, "849") ??
      firstAccountPrefix(subaccounts, "629") ??
      firstAccountPrefix(subaccounts, "505") ??
      null,
    defaultIvaAccount:
      firstAccountPrefix(subaccounts, "472") ?? tpDefaults.defaultIvaAccount ?? null,
    defaultIvaRepercutidoAccount:
      firstAccountPrefix(subaccounts, "477") ?? tpDefaults.defaultIvaRepercutidoAccount ?? null,
    defaultBankAccount:
      firstAccountPrefix(subaccounts, "572") ?? tpDefaults.defaultBankAccount ?? null,
    defaultSalesAccount:
      firstAccountPrefix(subaccounts, "705") ??
      firstAccountPrefix(subaccounts, "700") ??
      tpDefaults.defaultSalesAccount ??
      null,
    defaultClientAccount:
      firstAccountPrefix(subaccounts, "430") ?? tpDefaults.defaultClientAccount ?? null,
    defaultRetencionAccount:
      firstAccountPrefix(subaccounts, "473") ?? tpDefaults.defaultRetencionAccount ?? null,
  }
}

export function lookupVendorAccount(registry: NativePlanRegistry, vendorName: string): string | null {
  const key = normalizeVendorKey(vendorName)
  if (!key) return null

  const direct = registry.accountByVendorKey.get(key)
  if (direct) return direct

  let bestAccount: string | null = null
  let bestScore = 0

  for (const [vendorKey, accountCode] of registry.accountByVendorKey) {
    if (vendorKey.includes(key) || key.includes(vendorKey)) {
      const score = Math.min(vendorKey.length, key.length)
      if (score > bestScore) {
        bestScore = score
        bestAccount = accountCode
      }
      continue
    }

    const keyTokens = key.match(/.{4,}/g) ?? []
    let score = 0
    for (const token of keyTokens) {
      if (vendorKey.includes(token)) score += token.length
    }
    if (score > bestScore) {
      bestScore = score
      bestAccount = accountCode
    }
  }

  return bestScore >= 8 ? bestAccount : null
}

import {
  isGenericProviderCode,
  isProviderAccountCode,
  isResolvedProviderAccountCode,
  padAccountCode12,
} from "@/lib/imports/a3/native-account-code"
import { normalizeVendorKey } from "@/lib/imports/a3/vendor-matching"
import type { A3Subaccount } from "@/lib/imports/a3/types"

const PROVIDER_PREFIX = "400"
const CLIENT_PREFIX = "430"

function isSharedProviderCode(code: string): boolean {
  const digits = code.replace(/\D/g, "")
  return isGenericProviderCode(digits) || digits === "400000000100"
}

function nextUniqueCode(prefix: string, used: Set<string>, startSeq: number): { code: string; nextSeq: number } {
  let seq = startSeq
  while (used.has(prefix + String(seq).padStart(9, "0"))) {
    seq += 1
  }
  const code = prefix + String(seq).padStart(9, "0")
  return { code, nextSeq: seq + 1 }
}

/**
 * Asigna una subcuenta distinta por nombre de tercero aunque A3 reutilice 400000000100.
 */
export function buildUniqueVendorAccountMap(subaccounts: A3Subaccount[]): Map<string, string> {
  const accountByVendorKey = new Map<string, string>()
  const usedCodes = new Set<string>()
  let providerSeq = 100
  let clientSeq = 100

  for (const sub of subaccounts) {
    const key = normalizeVendorKey(sub.name)
    if (!key) continue
    if (accountByVendorKey.has(key)) continue

    const digits = padAccountCode12(sub.accountCode)
    const isClient = digits.startsWith(CLIENT_PREFIX)
    const isProvider = isProviderAccountCode(digits)

    let code = digits
    if (isProvider && isResolvedProviderAccountCode(code) && !isSharedProviderCode(code)) {
      // Cuenta real 400/410/4100 del export nativo A3: conservar tal cual.
    } else if (isProvider && isSharedProviderCode(code)) {
      const next = nextUniqueCode(PROVIDER_PREFIX, usedCodes, providerSeq)
      code = next.code
      providerSeq = next.nextSeq
    } else if (usedCodes.has(code)) {
      const next = nextUniqueCode(isClient ? CLIENT_PREFIX : PROVIDER_PREFIX, usedCodes, isClient ? clientSeq : providerSeq)
      code = next.code
      if (isClient) clientSeq = next.nextSeq
      else providerSeq = next.nextSeq
    }

    usedCodes.add(code)
    accountByVendorKey.set(key, code)
  }

  return accountByVendorKey
}

export function lookupUniqueVendorAccount(
  accountByVendorKey: Map<string, string>,
  vendorName: string,
): string | null {
  const key = normalizeVendorKey(vendorName)
  if (!key) return null

  const direct = accountByVendorKey.get(key)
  if (direct) return direct

  let bestAccount: string | null = null
  let bestScore = 0

  for (const [vendorKey, accountCode] of accountByVendorKey) {
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

export function subaccountsFromVendorAccountMap(
  subaccounts: A3Subaccount[],
  accountByVendorKey: Map<string, string>,
): A3Subaccount[] {
  const merged = new Map<string, A3Subaccount>()

  for (const sub of subaccounts) {
    merged.set(padAccountCode12(sub.accountCode), { ...sub, accountCode: padAccountCode12(sub.accountCode) })
  }

  for (const [vendorKey, accountCode] of accountByVendorKey) {
    if (merged.has(accountCode)) continue
    const original = subaccounts.find((sub) => normalizeVendorKey(sub.name) === vendorKey)
    if (!original) continue
    merged.set(accountCode, { accountCode, name: original.name, nif: original.nif })
  }

  return [...merged.values()]
}

export function ensureVendorAccount(
  accountByVendorKey: Map<string, string>,
  vendorName: string,
  prefix: typeof PROVIDER_PREFIX | typeof CLIENT_PREFIX = PROVIDER_PREFIX,
  displayNames?: Map<string, string>,
): string {
  const existing = lookupUniqueVendorAccount(accountByVendorKey, vendorName)
  if (existing) return existing

  const key = normalizeVendorKey(vendorName)
  if (!key) return prefix + "000000000"

  const used = new Set(accountByVendorKey.values())
  let seq = 100
  let code = prefix + String(seq).padStart(9, "0")
  while (used.has(code)) {
    seq += 1
    code = prefix + String(seq).padStart(9, "0")
  }

  accountByVendorKey.set(key, code)
  displayNames?.set(key, vendorName.trim())
  return code
}

export function subaccountsFromVendorRegistry(
  subaccounts: A3Subaccount[],
  accountByVendorKey: Map<string, string>,
  displayNames: Map<string, string>,
): A3Subaccount[] {
  const merged = new Map<string, A3Subaccount>()

  for (const sub of subaccounts) {
    merged.set(padAccountCode12(sub.accountCode), { ...sub, accountCode: padAccountCode12(sub.accountCode) })
  }

  for (const [vendorKey, accountCode] of accountByVendorKey) {
    if (merged.has(accountCode)) continue
    const original = subaccounts.find((sub) => normalizeVendorKey(sub.name) === vendorKey)
    const name = original?.name ?? displayNames.get(vendorKey) ?? vendorKey
    merged.set(accountCode, { accountCode, name, nif: original?.nif })
  }

  return [...merged.values()]
}
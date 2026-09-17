import { getAccountLabel } from "@/lib/reports/pgc-labels"
import { formatAccountNameDisplay } from "@/lib/reports/format"
import type { LedgerSubaccountOption } from "@/lib/accounting/ledger-subaccount-types"
import {
  parseDottedAccountShortcut,
  unresolvedDottedShortcut,
} from "@/lib/accounting/account-shortcut"
import { parseSubaccountSequence, formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"

export interface PgcAccount {
  code: string
  name: string
  searchText: string
}

export interface ChartAccountOption {
  code: string
  name: string
  accountCode: string
  source: "pgc" | "ledger" | "tercero"
}

export interface ChartAccountSearchParty {
  accountCode: string
  formattedAccountCode?: string
  name: string
  cif?: string
}

const COMMON_ACCOUNTS = [
  "430",
  "400",
  "472",
  "477",
  "4751",
  "4731",
  "4732",
  "476",
  "570",
  "572",
  "573",
  "600",
  "601",
  "602",
  "620",
  "621",
  "622",
  "623",
  "624",
  "625",
  "626",
  "627",
  "628",
  "629",
  "640",
  "642",
  "649",
  "700",
  "705",
  "708",
  "213",
  "281",
  "681",
  "678",
  "410",
  "411",
  "438",
  "440",
  "465",
] as const

const GROUP_CODES = [
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "39",
  "40",
  "41",
  "43",
  "44",
  "46",
  "47",
  "48",
  "49",
  "50",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "59",
  "60",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "67",
  "68",
  "69",
  "70",
  "71",
  "72",
  "73",
  "74",
  "75",
  "76",
  "77",
  "78",
  "79",
] as const

/** Sinónimos habituales para localizar cuentas por nombre en el plan contable. */
const ACCOUNT_SEARCH_ALIASES: Record<string, string[]> = {
  "43": ["clientes", "cliente", "cobros"],
  "430": ["clientes", "cliente", "cobros"],
  "438": ["clientes", "anticipos clientes"],
  "40": ["proveedores", "proveedor", "acreedores compras"],
  "400": ["proveedores", "proveedor"],
  "44": ["deudores", "deudor"],
  "440": ["deudores", "deudor"],
  "46": ["personal", "empleados", "nominas", "nóminas", "remuneraciones"],
  "465": ["personal", "nominas", "nóminas", "remuneraciones"],
  "47": ["hacienda", "administraciones publicas", "administraciones públicas", "iva", "aeat"],
  "472": ["iva soportado", "iva", "hacienda"],
  "477": ["iva repercutido", "iva", "hacienda"],
  "4751": ["iva", "hacienda", "aeat"],
  "57": ["tesoreria", "tesorería", "caja", "banco", "bancos", "efectivo"],
  "570": ["caja", "efectivo", "tesoreria", "tesorería"],
  "572": ["banco", "bancos", "tesoreria", "tesorería"],
  "60": ["compras", "gastos compras"],
  "64": ["personal", "sueldos", "salarios", "nominas", "nóminas"],
  "640": ["sueldos", "salarios", "personal", "nominas", "nóminas"],
  "70": ["ventas", "ingresos"],
  "705": ["ventas servicios", "prestaciones servicios", "ingresos"],
}

export function normalizePgcSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
}

function buildSearchText(code: string, name: string): string {
  const normalizedName = normalizePgcSearchText(name)
  const aliases = [
    ...(ACCOUNT_SEARCH_ALIASES[code] ?? []),
    ...(ACCOUNT_SEARCH_ALIASES[code.slice(0, 2)] ?? []),
    ...(ACCOUNT_SEARCH_ALIASES[code.slice(0, 3)] ?? []),
  ].map(normalizePgcSearchText)

  return normalizePgcSearchText([code, normalizedName, ...aliases].join(" "))
}

function buildAccount(code: string): PgcAccount {
  const name = getAccountLabel(code)
  return {
    code,
    name,
    searchText: buildSearchText(code, name),
  }
}

export const PGC_ACCOUNTS: PgcAccount[] = Array.from(
  new Map(
    [...GROUP_CODES, ...COMMON_ACCOUNTS].map((code) => [code, buildAccount(code)]),
  ).values(),
).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

function scoreAccountMatch(
  account: { code: string; searchText: string; name: string },
  query: string,
): number {
  const normalizedQuery = normalizePgcSearchText(query)
  if (!normalizedQuery) return 0

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const code = normalizePgcSearchText(account.code)
  const name = normalizePgcSearchText(account.name)
  const searchText = account.searchText

  const tokenMatches = tokens.every(
    (token) =>
      code.startsWith(token) ||
      code.includes(token) ||
      name.includes(token) ||
      searchText.includes(token),
  )

  if (!tokenMatches) return -1

  let score = 0
  if (code === normalizedQuery) score += 120
  else if (code.startsWith(normalizedQuery)) score += 100
  if (name === normalizedQuery) score += 90
  else if (name.startsWith(normalizedQuery)) score += 75
  else if (name.includes(normalizedQuery)) score += 55
  else if (searchText.includes(normalizedQuery)) score += 40

  for (const token of tokens) {
    if (code.startsWith(token)) score += 12
    if (name.includes(token)) score += 8
    if (searchText.includes(token)) score += 4
  }

  return score
}

export function searchPgcAccounts(query: string, limit = 50): PgcAccount[] {
  const normalized = normalizePgcSearchText(query)
  if (!normalized) return PGC_ACCOUNTS.slice(0, limit)

  return PGC_ACCOUNTS.map((account) => ({ account, score: scoreAccountMatch(account, query) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.account.code.localeCompare(b.account.code, undefined, { numeric: true }))
    .slice(0, limit)
    .map((item) => item.account)
}

function ledgerToSearchableAccount(account: LedgerSubaccountOption): {
  code: string
  name: string
  searchText: string
} {
  return {
    code: account.accountCode,
    name: account.name,
    searchText: normalizePgcSearchText(
      [account.accountCode, account.formattedAccountCode, account.name, account.parentCode].join(" "),
    ),
  }
}

function thirdPartyToSearchableAccount(party: ChartAccountSearchParty): {
  code: string
  name: string
  searchText: string
} {
  const formatted = party.formattedAccountCode || formatAccountCodeDisplay(party.accountCode)
  return {
    code: party.accountCode,
    name: party.name,
    searchText: normalizePgcSearchText(
      [party.accountCode, formatted, party.name, party.cif ?? ""].join(" "),
    ),
  }
}

function toLedgerOption(account: LedgerSubaccountOption): ChartAccountOption {
  return {
    code: account.formattedAccountCode,
    name: formatAccountNameDisplay(account.name),
    accountCode: account.accountCode,
    source: "ledger",
  }
}

function toThirdPartyOption(party: ChartAccountSearchParty): ChartAccountOption {
  return {
    code: party.formattedAccountCode || formatAccountCodeDisplay(party.accountCode),
    name: formatAccountNameDisplay(party.name),
    accountCode: party.accountCode,
    source: "tercero",
  }
}

function dedupeChartAccounts(accounts: ChartAccountOption[]): ChartAccountOption[] {
  const seen = new Set<string>()
  return accounts.filter((item) => {
    const key = item.accountCode.replace(/\D/g, "") || item.accountCode
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function typedAvailableChartAccount(query: string): ChartAccountOption | null {
  const dotted = parseDottedAccountShortcut(query)
  if (dotted) {
    const unresolved = unresolvedDottedShortcut(dotted)
    return {
      code: unresolved.formattedAccountCode,
      name: "Cuenta disponible",
      accountCode: unresolved.fallbackAccountCode,
      source: "pgc",
    }
  }

  const digits = query.replace(/\D/g, "")
  if (digits.length < 5) return null
  if (PGC_ACCOUNTS.some((account) => account.code === digits)) return null
  const parent = [...PGC_ACCOUNTS]
    .filter((account) => digits.startsWith(account.code) && digits.length > account.code.length)
    .sort((left, right) => right.code.length - left.code.length)[0]
  if (!parent) return null
  const sequence = parseSubaccountSequence(digits, parent.code)
  if (sequence === null || sequence < 1) return null
  return {
    code: formatAccountCodeDisplay(digits),
    name: "Cuenta disponible",
    accountCode: digits,
    source: "pgc",
  }
}

export function searchChartAccounts(
  query: string,
  options?: {
    ledgerSubaccounts?: LedgerSubaccountOption[]
    thirdParties?: ChartAccountSearchParty[]
    limit?: number
  },
): ChartAccountOption[] {
  const limit = options?.limit ?? 100
  const ledger = options?.ledgerSubaccounts ?? []
  const thirdParties = options?.thirdParties ?? []
  const normalized = normalizePgcSearchText(query)

  const openedOptions: ChartAccountOption[] = [
    ...thirdParties.map(toThirdPartyOption),
    ...ledger.map(toLedgerOption),
  ]

  const pgcResults: ChartAccountOption[] = searchPgcAccounts(query, limit).map((account) => ({
    code: formatAccountCodeDisplay(account.code),
    name: account.name,
    accountCode: account.code,
    source: "pgc" as const,
  }))

  if (!normalized) {
    return dedupeChartAccounts([...openedOptions, ...pgcResults]).slice(0, limit)
  }

  const scoredOpened = [
    ...thirdParties.map((party) => {
      const score = scoreAccountMatch(thirdPartyToSearchableAccount(party), query)
      return { option: toThirdPartyOption(party), score: score < 0 ? score : score + 25 }
    }),
    ...ledger.map((account) => {
      const score = scoreAccountMatch(ledgerToSearchableAccount(account), query)
      return { option: toLedgerOption(account), score: score < 0 ? score : score + 25 }
    }),
  ].filter((item) => item.score >= 0)

  const scoredPgc = pgcResults.map((option) => ({
    option,
    score: scoreAccountMatch(
      {
        code: option.accountCode,
        name: option.name,
        searchText: buildSearchText(option.accountCode, option.name),
      },
      query,
    ),
  }))

  const results = dedupeChartAccounts(
    [...scoredOpened, ...scoredPgc]
      .filter((item) => item.score >= 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.option.accountCode.localeCompare(b.option.accountCode, undefined, { numeric: true }),
      )
      .map((item) => item.option),
  )

  const typed = typedAvailableChartAccount(query)
  if (typed) {
    const typedDigits = typed.accountCode.replace(/\D/g, "")
    if (!results.some((account) => account.accountCode.replace(/\D/g, "") === typedDigits)) {
      results.unshift(typed)
    }
  }

  return results.slice(0, limit)
}

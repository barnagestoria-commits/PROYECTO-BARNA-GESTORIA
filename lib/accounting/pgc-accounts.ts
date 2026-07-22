import { getAccountLabel } from "@/lib/reports/pgc-labels"

export interface PgcAccount {
  code: string
  name: string
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

function buildAccount(code: string): PgcAccount {
  return {
    code,
    name: getAccountLabel(code),
  }
}

export const PGC_ACCOUNTS: PgcAccount[] = Array.from(
  new Map(
    [...GROUP_CODES, ...COMMON_ACCOUNTS].map((code) => [code, buildAccount(code)]),
  ).values(),
).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

export function searchPgcAccounts(query: string, limit = 50): PgcAccount[] {
  const normalized = query.trim().toLowerCase().replace(/\./g, "")
  if (!normalized) return PGC_ACCOUNTS.slice(0, limit)

  return PGC_ACCOUNTS.filter(
    (account) =>
      account.code.startsWith(normalized) ||
      account.name.toLowerCase().includes(normalized),
  ).slice(0, limit)
}

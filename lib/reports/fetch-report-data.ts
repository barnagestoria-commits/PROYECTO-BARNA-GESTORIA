import { buildBalanceReport } from "@/lib/reports/build-balance"
import { buildPygReport } from "@/lib/reports/build-pyg"
import { buildSumasSaldosReport } from "@/lib/reports/build-sumas-saldos"
import type { LedgerQuery } from "@/lib/reports/account-ledger"
import type {
  BalanceReportData,
  PygReportData,
  ReportMeta,
  ReportType,
  SumasSaldosReportData,
} from "@/lib/reports/types"

export type ReportData =
  | { type: "balance"; data: BalanceReportData }
  | { type: "sumas-saldos"; data: SumasSaldosReportData }
  | { type: "pyg"; data: PygReportData }

export function serializeReportMeta(meta: ReportMeta) {
  return {
    ...meta,
    generatedAt: meta.generatedAt.toISOString(),
  }
}

export function serializeReportData(report: ReportData) {
  return {
    type: report.type,
    data: {
      ...report.data,
      meta: serializeReportMeta(report.data.meta),
    },
  }
}

export async function fetchReportData(type: ReportType, query: LedgerQuery): Promise<ReportData> {
  switch (type) {
    case "balance":
      return { type, data: await buildBalanceReport(query) }
    case "sumas-saldos":
      return { type, data: await buildSumasSaldosReport(query) }
    case "pyg":
      return { type, data: await buildPygReport(query) }
  }
}

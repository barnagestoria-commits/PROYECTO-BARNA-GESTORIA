import { prisma } from "@/lib/db"
import { fetchBalancesForSlices, type LedgerQuery } from "@/lib/reports/account-ledger"
import { buildStatementLayout, type CostCenterListing } from "@/lib/reports/statement-layout"
import type { AccountBalance } from "@/lib/reports/types"

export async function loadStatementSource(query: LedgerQuery, kind: "balance" | "pyg") {
  const listing: CostCenterListing =
    query.costCenterListing ?? (query.costCenterId ? "centro" : "consolidado")
  const costCenters =
    listing === "por-centros"
      ? await prisma.costCenter.findMany({
          where: { companyId: query.companyId, isActive: true },
          select: { id: true, code: true, name: true },
          orderBy: { code: "asc" },
        })
      : []
  const compareYears = query.compareYears?.length
    ? query.compareYears
    : query.compareYear
      ? [query.compareYear]
      : []
  const layout = buildStatementLayout({
    kind,
    year: query.year,
    compareYears,
    breakdown: listing === "por-centros" ? "anual" : query.breakdown ?? "anual",
    fromMonth: query.fromMonth ?? 1,
    toMonth: query.toMonth ?? 12,
    costCenterListing: listing,
    costCenters,
    costCenterId: query.costCenterId,
  })
  const slices: Map<string, AccountBalance[]> = await fetchBalancesForSlices(
    query.companyId,
    layout.slices,
    query.detailLevel ?? "SUBCUENTAS",
  )
  return { layout, slices }
}

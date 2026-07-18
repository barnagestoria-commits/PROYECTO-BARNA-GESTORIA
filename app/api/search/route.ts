import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { filterStaticCommandItems } from "@/lib/search/command-palette-index"
import { searchCommandPalette } from "@/lib/search/search-service"
import type { CommandPaletteItem } from "@/lib/search/command-palette-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { session, companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const query = url.searchParams.get("q")?.trim() ?? ""

    const staticResults = filterStaticCommandItems(query, 10)
    const { thirdParties, accounts } = await searchCommandPalette(companyId, query)

    const companyResults: CommandPaletteItem[] =
      query.length >= 2
        ? session.companies
            .filter((company) => {
              const haystack = `${company.name} ${company.cif ?? ""}`.toLowerCase()
              return haystack.includes(query.toLowerCase())
            })
            .slice(0, 5)
            .map((company) => ({
              id: `company-${company.id}`,
              kind: "company",
              title: company.name,
              subtitle: company.cif ? `NIF ${company.cif}` : "Empresa cliente",
              action: "switch-company",
              companyId: company.id,
              keywords: [company.cif ?? ""],
            }))
        : []

    return NextResponse.json({
      success: true,
      query,
      results: {
        navigation: staticResults.filter((item) => item.kind === "navigation"),
        actions: staticResults.filter((item) => item.kind === "action"),
        thirdParties,
        accounts,
        companies: companyResults,
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}

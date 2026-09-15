import type { GestoriaEntityType } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { GestoriaActivity } from "@/lib/contabilidad/gestoria-client-profile-types"
import type { CompanyActivityHint } from "@/lib/accounting/invoice-supplier-classification"

export interface CompanyPurchaseContext {
  entityType: GestoriaEntityType | null
  activities: CompanyActivityHint[]
}

export async function loadCompanyPurchaseContext(companyId: string): Promise<CompanyPurchaseContext> {
  const profile = await prisma.companyGestoriaProfile.findUnique({
    where: { companyId },
    select: { activitiesJson: true, entityType: true },
  })

  if (!profile) {
    return { entityType: null, activities: [] }
  }

  let activities: CompanyActivityHint[] = []
  if (profile.activitiesJson) {
    try {
      const parsed = JSON.parse(profile.activitiesJson) as GestoriaActivity[]
      if (Array.isArray(parsed)) {
        activities = parsed.map((activity) => ({
          epigraph: activity.epigraph,
          description: activity.description,
          type: activity.type,
        }))
      }
    } catch {
      activities = []
    }
  }

  return {
    entityType: profile.entityType,
    activities,
  }
}

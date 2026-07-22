"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { TaxSummaryPanel } from "@/components/tax-summary-panel"
import { FinancialAnalyticsDashboard } from "@/components/dashboard/financial-analytics-dashboard"
import { useRequireAuth } from "@/components/auth-provider"

const ACTION_REDIRECTS: Record<string, string> = {
  "subir-factura-recibida": "/dashboard/compras/facturas-recibidas",
  "subir-factura-emitida": "/dashboard/ventas/facturas-emitidas",
  "subir-extracto": "/dashboard/compras/extractos",
}

function DashboardPageContent() {
  const { session, activeCompany } = useRequireAuth()
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const accion = searchParams.get("accion")
    if (accion && ACTION_REDIRECTS[accion]) {
      router.replace(ACTION_REDIRECTS[accion])
    }
  }, [searchParams, router])

  if (!session) {
    return null
  }

  const noCompany = session.companies.length === 0

  return (
    <>
      {noCompany ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-600">
            {session.user.accountType === "GESTORIA" ? (
              <p>Tu gestoría aún no tiene empresas clientes asignadas.</p>
            ) : (
              <p>No se encontró empresa vinculada a tu cuenta.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <FinancialAnalyticsDashboard
            userName={session.user.name}
            companyName={activeCompany?.name}
            uploadHref="/dashboard/compras/facturas-recibidas"
          />

          <div className="my-8 border-t border-sand-200" />

          <TaxSummaryPanel companyId={session.activeCompanyId} />
        </>
      )}
    </>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  )
}

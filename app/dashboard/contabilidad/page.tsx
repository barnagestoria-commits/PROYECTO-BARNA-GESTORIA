"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogOut, ArrowLeft } from "lucide-react"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { CompanySelector } from "@/components/company-selector"
import { QuickAccountingEntryForm } from "@/components/quick-accounting-entry-form"
import { useRequireAuth } from "@/components/auth-provider"

export default function ContabilidadPage() {
  const { session, panelTitle, roleLabel, activeCompany, logout, isLoading } = useRequireAuth()

  if (isLoading || !session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <ResponsiveLogo size="sm" />
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-emerald-800">
                Contabilización — {panelTitle}
              </h1>
              <p className="text-xs text-gray-500">
                {session.user.name} • {roleLabel}
                {activeCompany && ` • ${activeCompany.name}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CompanySelector />
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Documentos
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <QuickAccountingEntryForm />
      </div>
    </div>
  )
}

"use client"

import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { QuickAccountingEntryForm } from "@/components/quick-accounting-entry-form"

export default function ContabilidadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
        </div>
      }
    >
      <QuickAccountingEntryForm />
    </Suspense>
  )
}

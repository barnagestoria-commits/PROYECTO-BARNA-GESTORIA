import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { ImportExportHub } from "@/components/import-export/import-export-hub"

export default function ImportarDatosContablesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
        </div>
      }
    >
      <ImportExportHub />
    </Suspense>
  )
}

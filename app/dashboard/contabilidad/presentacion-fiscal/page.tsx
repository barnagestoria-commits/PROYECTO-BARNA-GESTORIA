import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { GestoriaPresentationPage } from "@/components/contabilidad/gestoria-presentation-page"

export default function PresentacionFiscalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-emerald-800">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando…
        </div>
      }
    >
      <GestoriaPresentationPage />
    </Suspense>
  )
}

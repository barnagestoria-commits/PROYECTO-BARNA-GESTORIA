import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { SupportAccountsWorkspace } from "@/components/support/support-accounts-workspace"

export default function SoportePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
        </div>
      }
    >
      <SupportAccountsWorkspace />
    </Suspense>
  )
}

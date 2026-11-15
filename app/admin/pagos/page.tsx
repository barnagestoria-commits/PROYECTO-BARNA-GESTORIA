import type { Metadata } from "next"
import { DashboardShell } from "@/components/dashboard-shell"
import { PaymentsAdminPanel } from "@/components/admin/payments-admin-panel"

export const metadata: Metadata = {
  title: "Pagos por transferencia | Taxlyn",
  robots: { index: false, follow: false },
}

export default function AdminPagosPage() {
  return (
    <DashboardShell>
      <PaymentsAdminPanel />
    </DashboardShell>
  )
}

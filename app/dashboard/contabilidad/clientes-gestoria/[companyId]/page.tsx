import { GestoriaClientDashboard } from "@/components/contabilidad/gestoria-client-dashboard"

interface PageProps {
  params: Promise<{ companyId: string }>
}

export default async function GestoriaClientDashboardPage({ params }: PageProps) {
  const { companyId } = await params
  return <GestoriaClientDashboard companyId={companyId} />
}

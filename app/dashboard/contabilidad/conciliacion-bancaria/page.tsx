import { BankReconciliationWorkspace } from "@/components/bank-reconciliation/bank-reconciliation-workspace"

export default function ConciliacionBancariaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-pine-900">Conciliación bancaria</h1>
        <p className="mt-1 text-sm text-graphite-600">
          Importa extractos (CSV, Excel o PDF) y concilia movimientos con las cuentas 572/570 del diario.
        </p>
      </div>
      <BankReconciliationWorkspace />
    </div>
  )
}

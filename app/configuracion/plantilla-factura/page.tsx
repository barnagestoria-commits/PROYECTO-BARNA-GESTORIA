import { InvoiceTemplateDesigner } from "@/components/invoices/invoice-template-designer"

export default function PlantillaFacturaPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-pine-900">Plantilla de facturación emitida</h1>
        <p className="mt-1 text-sm text-graphite-600">
          Diseña el PDF de tus facturas con cumplimiento Veri*factu y del Código de Comercio.
        </p>
      </div>
      <InvoiceTemplateDesigner />
    </div>
  )
}

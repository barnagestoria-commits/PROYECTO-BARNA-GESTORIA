import { DocumentUploadWorkspace } from "@/components/documents/document-upload-workspace"

export default function FacturasEmitidasPage() {
  return (
    <DocumentUploadWorkspace
      documentType="factura-emitida"
      title="Facturas emitidas"
      description="Sube ventas y facturas que emite tu empresa hacia clientes. El OCR propone cliente (430) e ingreso (700 o 705) según la actividad."
    />
  )
}

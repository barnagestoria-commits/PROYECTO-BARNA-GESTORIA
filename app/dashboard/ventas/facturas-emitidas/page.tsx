import { DocumentUploadWorkspace } from "@/components/documents/document-upload-workspace"

export default function FacturasEmitidasPage() {
  return (
    <DocumentUploadWorkspace
      documentType="factura-emitida"
      title="Facturas emitidas"
      description="Sube ventas y facturas que emite tu empresa hacia clientes. Cámara, PDF o imagen."
    />
  )
}

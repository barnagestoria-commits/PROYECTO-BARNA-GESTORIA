import { DocumentUploadWorkspace } from "@/components/documents/document-upload-workspace"

export default function FacturasRecibidasPage() {
  return (
    <DocumentUploadWorkspace
      documentType="factura-recibida"
      title="Facturas recibidas"
      description="Gastos y compras con OCR automático de proveedor, CIF e importes."
      cameraTourId="scan-invoice"
    />
  )
}

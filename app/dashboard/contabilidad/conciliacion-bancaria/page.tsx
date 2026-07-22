import { DocumentUploadWorkspace } from "@/components/documents/document-upload-workspace"

export default function ConciliacionBancariaPage() {
  return (
    <DocumentUploadWorkspace
      documentType="extracto-bancario"
      title="Conciliación bancaria"
      description="Sube extractos bancarios y concilia movimientos de tesorería con la contabilidad."
    />
  )
}

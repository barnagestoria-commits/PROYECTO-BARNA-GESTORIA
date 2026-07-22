import { DocumentUploadWorkspace } from "@/components/documents/document-upload-workspace"

export default function ExtractosBancariosPage() {
  return (
    <DocumentUploadWorkspace
      documentType="extracto-bancario"
      title="Extractos bancarios"
      description="Movimientos bancarios y conciliación de tesorería."
    />
  )
}

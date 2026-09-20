export type FilingCertificateSource = "client" | "representation" | "none"

export function resolveFilingCertificateSource(input: {
  hasClientCertificate: boolean
  hasRepresentationCertificate: boolean
}): FilingCertificateSource {
  if (input.hasClientCertificate) return "client"
  if (input.hasRepresentationCertificate) return "representation"
  return "none"
}

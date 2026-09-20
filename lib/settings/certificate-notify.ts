export type CertificateChangeOrigin = "fetch" | "save" | "delete"

/** The parent should only react when the user uploads or deletes a certificate. */
export function shouldBroadcastCertificateChange(origin: CertificateChangeOrigin): boolean {
  return origin !== "fetch"
}

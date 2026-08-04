export function readZipPasswordFromFormData(formData: FormData): string | undefined {
  const raw = formData.get("zipPassword")
  if (typeof raw !== "string") return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

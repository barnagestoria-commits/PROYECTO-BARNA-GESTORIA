import { prisma } from "@/lib/db"
import { parsePkcs12Certificate } from "@/lib/certificate/parse-pkcs12"
import type { StoredDigitalCertificate, VerifactuEnvironment } from "@/lib/settings/certificate-storage"

export interface SaveDigitalCertificateInput {
  fileName: string
  password: string
  environment: VerifactuEnvironment
  fileBase64: string
}

function decodeCertificateBuffer(fileBase64: string): Buffer {
  const normalized = fileBase64.includes(",") ? fileBase64.split(",").pop() ?? "" : fileBase64
  const buffer = Buffer.from(normalized, "base64")

  if (buffer.length === 0) {
    throw new Error("El archivo del certificado está vacío.")
  }

  return buffer
}

function serializeCertificate(record: {
  fileName: string
  holderName: string
  taxId: string
  expiresAt: Date
  environment: string
  uploadedAt: Date
}): StoredDigitalCertificate {
  return {
    fileName: record.fileName,
    holderName: record.holderName,
    issuerNif: record.taxId,
    expiresAt: record.expiresAt.toISOString(),
    environment: record.environment === "production" ? "production" : "sandbox",
    uploadedAt: record.uploadedAt.toISOString(),
  }
}

export async function getCompanyDigitalCertificate(
  companyId: string,
): Promise<StoredDigitalCertificate | null> {
  const record = await prisma.companyDigitalCertificate.findUnique({
    where: { companyId },
  })

  if (!record) return null
  return serializeCertificate(record)
}

export async function saveCompanyDigitalCertificate(
  companyId: string,
  input: SaveDigitalCertificateInput,
): Promise<StoredDigitalCertificate> {
  const buffer = decodeCertificateBuffer(input.fileBase64)
  const parsed = parsePkcs12Certificate(buffer, input.password)

  const record = await prisma.$transaction(async (tx) => {
    const saved = await tx.companyDigitalCertificate.upsert({
      where: { companyId },
      create: {
        companyId,
        holderName: parsed.holderName,
        taxId: parsed.taxId,
        fileName: input.fileName,
        expiresAt: parsed.expiresAt,
        environment: input.environment,
      },
      update: {
        holderName: parsed.holderName,
        taxId: parsed.taxId,
        fileName: input.fileName,
        expiresAt: parsed.expiresAt,
        environment: input.environment,
        uploadedAt: new Date(),
      },
    })

    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: { cif: true },
    })

    if (!company?.cif?.trim()) {
      await tx.company.update({
        where: { id: companyId },
        data: { cif: parsed.taxId },
      })
    }

    return saved
  })

  return serializeCertificate(record)
}

export async function deleteCompanyDigitalCertificate(companyId: string): Promise<void> {
  await prisma.companyDigitalCertificate.deleteMany({ where: { companyId } })
}

export async function getGestoriaInternalCompanyId(accountId: string): Promise<string | null> {
  const company = await prisma.company.findFirst({
    where: { accountId, kind: "GESTORIA_PROPIA" },
    select: { id: true },
  })
  return company?.id ?? null
}

export async function getGestoriaRepresentationCertificate(
  accountId: string,
): Promise<StoredDigitalCertificate | null> {
  const companyId = await getGestoriaInternalCompanyId(accountId)
  if (!companyId) return null
  return getCompanyDigitalCertificate(companyId)
}

export async function saveGestoriaRepresentationCertificate(
  accountId: string,
  input: SaveDigitalCertificateInput,
): Promise<StoredDigitalCertificate> {
  const companyId = await getGestoriaInternalCompanyId(accountId)
  if (!companyId) {
    throw new Error("Esta gestoría no tiene una empresa propia para el certificado de representación.")
  }
  return saveCompanyDigitalCertificate(companyId, input)
}

export async function deleteGestoriaRepresentationCertificate(accountId: string): Promise<void> {
  const companyId = await getGestoriaInternalCompanyId(accountId)
  if (!companyId) return
  await deleteCompanyDigitalCertificate(companyId)
}

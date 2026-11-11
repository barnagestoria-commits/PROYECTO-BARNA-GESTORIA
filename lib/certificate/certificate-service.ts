import { prisma } from "@/lib/db"
import { parsePkcs12Certificate } from "@/lib/certificate/parse-pkcs12"
import type { StoredDigitalCertificate, VerifactuEnvironment } from "@/lib/settings/certificate-storage"
import { decryptCertificatePayload, encryptCertificatePayload } from "@/lib/storage/certificate-crypto"
import {
  deleteStoredObject,
  getStoredObject,
  putCompanyObject,
} from "@/lib/storage/object-storage"
import { assertUploadSize, UPLOAD_LIMITS_BYTES } from "@/lib/storage/upload-limits"

export interface SaveDigitalCertificateInput {
  fileName: string
  password: string
  environment: VerifactuEnvironment
  fileBase64: string
}

export interface CompanyCertificateMaterial {
  p12: Buffer
  password: string
  fileName: string
  environment: VerifactuEnvironment
}

function decodeCertificateBuffer(fileBase64: string): Buffer {
  const normalized = fileBase64.includes(",") ? fileBase64.split(",").pop() ?? "" : fileBase64
  const buffer = Buffer.from(normalized, "base64")

  if (buffer.length === 0) {
    throw new Error("El archivo del certificado está vacío.")
  }

  assertUploadSize(buffer.length, UPLOAD_LIMITS_BYTES.certificate, "El certificado digital")
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

export async function loadCompanyCertificateMaterial(
  companyId: string,
): Promise<CompanyCertificateMaterial> {
  const record = await prisma.companyDigitalCertificate.findUnique({
    where: { companyId },
  })

  if (!record) {
    throw new Error("Esta empresa no tiene un certificado digital. Súbelo en Configuración.")
  }
  if (!record.storageKey) {
    throw new Error(
      "El certificado guardado no tiene el archivo original. Vuelve a subir el .p12 o .pfx.",
    )
  }

  const envelope = await getStoredObject(record.storageKey)
  const material = decryptCertificatePayload(companyId, envelope)
  return {
    p12: material.p12,
    password: material.password,
    fileName: record.fileName,
    environment: record.environment === "production" ? "production" : "sandbox",
  }
}

export async function saveCompanyDigitalCertificate(
  companyId: string,
  input: SaveDigitalCertificateInput,
): Promise<StoredDigitalCertificate> {
  const buffer = decodeCertificateBuffer(input.fileBase64)
  const parsed = parsePkcs12Certificate(buffer, input.password)
  const previous = await prisma.companyDigitalCertificate.findUnique({
    where: { companyId },
    select: { storageKey: true },
  })

  const envelope = encryptCertificatePayload({
    companyId,
    p12: buffer,
    password: input.password,
  })
  const stored = await putCompanyObject({
    companyId,
    kind: "certificates",
    fileName: input.fileName,
    body: envelope,
    contentType: "application/octet-stream",
  })

  try {
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
          storageKey: stored.storageKey,
          contentType: stored.contentType,
          sha256: stored.sha256,
          byteSize: stored.byteSize,
        },
        update: {
          holderName: parsed.holderName,
          taxId: parsed.taxId,
          fileName: input.fileName,
          expiresAt: parsed.expiresAt,
          environment: input.environment,
          uploadedAt: new Date(),
          storageKey: stored.storageKey,
          contentType: stored.contentType,
          sha256: stored.sha256,
          byteSize: stored.byteSize,
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

    if (previous?.storageKey && previous.storageKey !== stored.storageKey) {
      await deleteStoredObject(previous.storageKey)
    }

    return serializeCertificate(record)
  } catch (error) {
    await deleteStoredObject(stored.storageKey)
    throw error
  }
}

export async function deleteCompanyDigitalCertificate(companyId: string): Promise<void> {
  const record = await prisma.companyDigitalCertificate.findUnique({
    where: { companyId },
    select: { storageKey: true },
  })
  await prisma.companyDigitalCertificate.deleteMany({ where: { companyId } })
  await deleteStoredObject(record?.storageKey)
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

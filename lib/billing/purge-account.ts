import { prisma } from "@/lib/db"
import { deleteStoredObject } from "@/lib/storage/object-storage"

/**
 * Elimina una cuenta con todos sus datos y los archivos asociados (facturas, extractos, justificantes).
 * Es irreversible. Quien la llame debe haber comprobado antes que procede (ver trial-lifecycle.ts).
 */
export async function purgeAccount(accountId: string): Promise<{ files: number }> {
  const companies = await prisma.company.findMany({ where: { accountId }, select: { id: true } })
  const companyIds = companies.map((company) => company.id)
  const users = await prisma.user.findMany({ where: { accountId }, select: { id: true } })
  const userIds = users.map((user) => user.id)

  const [documents, statements, certificates, exports, receipts] = await Promise.all([
    prisma.fiscalDocument.findMany({
      where: { companyId: { in: companyIds }, storageKey: { not: null } },
      select: { storageKey: true },
    }),
    prisma.bankStatementImport.findMany({
      where: { companyId: { in: companyIds }, storageKey: { not: null } },
      select: { storageKey: true },
    }),
    prisma.companyDigitalCertificate.findMany({
      where: { companyId: { in: companyIds }, storageKey: { not: null } },
      select: { storageKey: true },
    }),
    prisma.taxExportArtifact.findMany({
      where: { taxReturn: { companyId: { in: companyIds } }, storageKey: { not: null } },
      select: { storageKey: true },
    }),
    prisma.pagoPendiente.findMany({
      where: { userId: { in: userIds } },
      select: { comprobanteKey: true },
    }),
  ])

  const keys = [
    ...documents.map((row) => row.storageKey),
    ...statements.map((row) => row.storageKey),
    ...certificates.map((row) => row.storageKey),
    ...exports.map((row) => row.storageKey),
    ...receipts.map((row) => row.comprobanteKey),
  ].filter((key): key is string => Boolean(key))

  // Primero la base de datos (si falla, no se pierde ningún archivo); luego los archivos.
  await prisma.account.delete({ where: { id: accountId } })

  let removed = 0
  for (const key of keys) {
    try {
      await deleteStoredObject(key)
      removed += 1
    } catch (error) {
      console.error(`[taxlyn] No se pudo borrar el archivo ${key} de una cuenta eliminada.`, error)
    }
  }
  return { files: removed }
}

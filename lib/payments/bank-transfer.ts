import { prisma } from "@/lib/db"
import type { PlanDescription } from "@/lib/billing/plan-request"
import { canUpgradeAccountType } from "@/lib/settings/subscription-plans"
import { formatIbanDisplay, isValidIban, normalizeIban } from "@/lib/banking/iban"
import { putPaymentProofObject, deleteStoredObject } from "@/lib/storage/object-storage"
import {
  MAX_RECEIPT_BYTES,
  receiptStoredFileName,
  sniffReceiptContentType,
} from "@/lib/payments/receipt-file"

export type PagoEstado = "pendiente" | "aprobado" | "rechazado"

/** Valores de partida. Se usan hasta que el operador guarde los suyos desde /admin/pagos. */
export const DEFAULT_BANK_DETAILS = {
  iban: "ES1715830001199048619114",
  beneficiary: "Sonia Macías Tumbaco",
  bankName: null as string | null,
  instructions: null as string | null,
}

/** Tope de justificantes sin revisar por usuario, para que nadie llene la bandeja del operador. */
const MAX_PENDING_PER_USER = 5

export interface BankDetails {
  iban: string
  ibanDisplay: string
  beneficiary: string
  bankName: string | null
  instructions: string | null
}

export interface OwnPayment {
  id: string
  estado: PagoEstado
  fecha: string
  fileName: string
}

function toBankDetails(row: {
  iban: string
  beneficiary: string
  bankName: string | null
  instructions: string | null
}): BankDetails {
  return {
    iban: row.iban,
    ibanDisplay: formatIbanDisplay(row.iban),
    beneficiary: row.beneficiary,
    bankName: row.bankName,
    instructions: row.instructions,
  }
}

export async function getBankDetails(): Promise<BankDetails> {
  const row = await prisma.bankTransferSettings.findUnique({ where: { id: "default" } })
  return toBankDetails(row ?? DEFAULT_BANK_DETAILS)
}

export async function saveBankDetails(
  operatorUserId: string,
  input: { iban?: unknown; beneficiary?: unknown; bankName?: unknown; instructions?: unknown },
): Promise<BankDetails> {
  const iban = normalizeIban(typeof input.iban === "string" ? input.iban : "")
  if (!isValidIban(iban)) {
    throw new Error("El IBAN no es válido. Revísalo, incluido el código de país y los dígitos de control.")
  }

  const beneficiary = typeof input.beneficiary === "string" ? input.beneficiary.trim().replace(/\s+/g, " ") : ""
  if (beneficiary.length < 2 || beneficiary.length > 100) {
    throw new Error("Indica el nombre del beneficiario (entre 2 y 100 caracteres).")
  }

  const optional = (value: unknown, max: number, label: string): string | null => {
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    if (!trimmed) return null
    if (trimmed.length > max) throw new Error(`${label} no puede pasar de ${max} caracteres.`)
    return trimmed
  }
  const bankName = optional(input.bankName, 70, "El nombre del banco")
  const instructions = optional(input.instructions, 500, "Las indicaciones")

  const data = { iban, beneficiary, bankName, instructions, updatedBy: operatorUserId }
  const row = await prisma.bankTransferSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  })
  return toBankDetails(row)
}

export async function listOwnPayments(userId: string): Promise<OwnPayment[]> {
  const rows = await prisma.pagoPendiente.findMany({
    where: { userId },
    orderBy: { fecha: "desc" },
    take: 20,
    select: { id: true, estado: true, fecha: true, fileName: true },
  })
  return rows.map((row) => ({
    id: row.id,
    estado: row.estado as PagoEstado,
    fecha: row.fecha.toISOString(),
    fileName: row.fileName,
  }))
}

/** Valida el archivo, lo guarda en el almacén privado y crea el registro `pendiente`. */
export async function submitPaymentReceipt(
  userId: string,
  file: { name: string; bytes: Buffer },
  plan: PlanDescription | null = null,
): Promise<{ payment: OwnPayment; duplicate: boolean }> {
  if (file.bytes.length === 0) {
    throw new Error("El archivo está vacío.")
  }
  if (file.bytes.length > MAX_RECEIPT_BYTES) {
    throw new Error("El archivo pesa más de 4 MB. Sube una foto más pequeña o el PDF del banco.")
  }
  const contentType = sniffReceiptContentType(file.bytes)
  if (!contentType) {
    throw new Error("Formato no admitido. Sube el justificante en PDF, JPG, PNG o WebP.")
  }

  const pendingCount = await prisma.pagoPendiente.count({ where: { userId, estado: "pendiente" } })
  if (pendingCount >= MAX_PENDING_PER_USER) {
    throw new Error("Ya tienes varios justificantes pendientes de revisar. Te avisaremos en cuanto los validemos.")
  }

  const fileName = receiptStoredFileName(file.name, contentType)
  const stored = await putPaymentProofObject({ userId, fileName, body: file.bytes, contentType })

  // Doble clic o reintento: el mismo archivo del mismo usuario no genera un segundo registro.
  const existing = await prisma.pagoPendiente.findFirst({
    where: { userId, sha256: stored.sha256, estado: "pendiente" },
    select: { id: true, estado: true, fecha: true, fileName: true },
  })
  if (existing) {
    await deleteStoredObject(stored.storageKey)
    return {
      duplicate: true,
      payment: {
        id: existing.id,
        estado: existing.estado as PagoEstado,
        fecha: existing.fecha.toISOString(),
        fileName: existing.fileName,
      },
    }
  }

  try {
    const row = await prisma.pagoPendiente.create({
      data: {
        userId,
        comprobanteUrl: stored.url,
        comprobanteKey: stored.storageKey,
        fileName,
        contentType,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
        estado: "pendiente",
        planAccountType: plan?.accountType ?? null,
        planTierId: plan?.tierId ?? null,
        planLabel: plan?.label ?? null,
        importeEuros: plan?.priceEuros ?? null,
      },
      select: { id: true, estado: true, fecha: true, fileName: true },
    })
    return {
      duplicate: false,
      payment: {
        id: row.id,
        estado: row.estado as PagoEstado,
        fecha: row.fecha.toISOString(),
        fileName: row.fileName,
      },
    }
  } catch (error) {
    // Sin registro no hay quien revise el archivo: no dejamos objetos huérfanos.
    await deleteStoredObject(stored.storageKey)
    throw error
  }
}

export interface AdminPaymentRow {
  id: string
  estado: PagoEstado
  fecha: string
  fileName: string
  contentType: string
  byteSize: number
  /** Ruta protegida (solo operador) para ver el justificante. */
  previewUrl: string
  /** El mismo archivo ya lo subió otro usuario: conviene mirarlo antes de aprobar. */
  repeatedByOthers: boolean
  /** Plan que el cliente quiere contratar y cuánto debería haber transferido. */
  plan: { label: string; importeEuros: number | null } | null
  user: { id: string; name: string; email: string; accountName: string; isActive: boolean }
}

export async function listPaymentsForOperator(filter: PagoEstado | "todos"): Promise<AdminPaymentRow[]> {
  const rows = await prisma.pagoPendiente.findMany({
    where: filter === "todos" ? {} : { estado: filter },
    orderBy: { fecha: filter === "pendiente" ? "asc" : "desc" },
    take: 200,
    select: {
      id: true,
      estado: true,
      fecha: true,
      fileName: true,
      contentType: true,
      byteSize: true,
      sha256: true,
      userId: true,
      planLabel: true,
      importeEuros: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          account: { select: { name: true } },
        },
      },
    },
  })

  const hashes = [...new Set(rows.map((row) => row.sha256))]
  const sameHash = hashes.length
    ? await prisma.pagoPendiente.findMany({
        where: { sha256: { in: hashes } },
        select: { sha256: true, userId: true },
      })
    : []

  return rows.map((row) => ({
    id: row.id,
    estado: row.estado as PagoEstado,
    fecha: row.fecha.toISOString(),
    fileName: row.fileName,
    contentType: row.contentType,
    byteSize: row.byteSize,
    previewUrl: `/api/admin/pagos/${row.id}/comprobante`,
    repeatedByOthers: sameHash.some((other) => other.sha256 === row.sha256 && other.userId !== row.userId),
    plan: row.planLabel ? { label: row.planLabel, importeEuros: row.importeEuros } : null,
    user: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      accountName: row.user.account.name,
      isActive: row.user.isActive,
    },
  }))
}

/**
 * Aprueba el pago en una sola transacción: marca el pago, activa al usuario y activa la cuenta
 * (sale de la prueba) con el plan que pidió el cliente. `updateMany` con estado = pendiente evita
 * aprobar dos veces si se pulsa el botón en dos pestañas.
 */
export async function approvePayment(paymentId: string, operatorUserId: string): Promise<{ userId: string }> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.pagoPendiente.updateMany({
      where: { id: paymentId, estado: "pendiente" },
      data: { estado: "aprobado", revisadoPor: operatorUserId, revisadoAt: new Date() },
    })
    if (updated.count === 0) {
      throw new Error("Este pago ya no está pendiente o no existe.")
    }

    const payment = await tx.pagoPendiente.findUnique({
      where: { id: paymentId },
      select: {
        userId: true,
        planAccountType: true,
        planTierId: true,
        user: { select: { accountId: true } },
      },
    })
    if (!payment) {
      throw new Error("No se encontró el pago.")
    }

    await tx.user.update({ where: { id: payment.userId }, data: { isActive: true } })

    const account = await tx.account.findUniqueOrThrow({
      where: { id: payment.user.accountId },
      select: { id: true, accountType: true },
    })

    const data: {
      accessStatus: "ACTIVE"
      trialEndsAt: null
      lifecycleNotices: string[]
      requestedAccountType: null
      requestedTierId: null
      planTierId?: string
      accountType?: "GESTORIA" | "CLIENTE_FINAL" | "EMPRESA"
    } = {
      accessStatus: "ACTIVE",
      trialEndsAt: null,
      lifecycleNotices: [],
      requestedAccountType: null,
      requestedTierId: null,
    }

    if (payment.planTierId) {
      data.planTierId = payment.planTierId
    }

    if (
      payment.planAccountType &&
      payment.planAccountType !== account.accountType &&
      canUpgradeAccountType(account.accountType, payment.planAccountType)
    ) {
      data.accountType = payment.planAccountType
      if (payment.planAccountType === "GESTORIA") {
        await tx.user.update({ where: { id: payment.userId }, data: { role: "ADMIN_GESTOR" } })
        const company = await tx.company.findFirst({
          where: { accountId: account.id, kind: "STANDARD" },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        })
        if (company) {
          await tx.company.update({ where: { id: company.id }, data: { kind: "GESTORIA_PROPIA" } })
        }
      }
    }

    await tx.account.update({ where: { id: account.id }, data })
    return { userId: payment.userId }
  })
}

export async function getPaymentProofForOperator(paymentId: string) {
  return prisma.pagoPendiente.findUnique({
    where: { id: paymentId },
    select: { comprobanteKey: true, contentType: true, fileName: true },
  })
}

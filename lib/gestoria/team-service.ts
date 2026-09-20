import { prisma } from "@/lib/db"
import { hashPassword } from "@/lib/auth/password"
import {
  assertSeatAvailable,
  assignedCarteraCompanyIds,
  canManageGestoriaTeam,
  DEFAULT_GESTORIA_SEATS,
  remainingSeats,
} from "@/lib/auth/gestoria-access"
import type { GestoriaTeamMemberDto, GestoriaTeamSnapshot } from "@/lib/gestoria/team-types"
import type { UserRole } from "@/lib/types/auth"

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function listGestoriaTeam(accountId: string): Promise<GestoriaTeamSnapshot> {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { maxSeats: true },
  })

  const [users, clients] = await Promise.all([
    prisma.user.findMany({
      where: { accountId },
      include: {
        companyAccess: {
          include: {
            company: { select: { id: true, kind: true } },
          },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.company.findMany({
      where: { accountId, kind: "CLIENTE_CARTERA" },
      select: { id: true, name: true, cif: true },
      orderBy: { name: "asc" },
    }),
  ])

  const maxSeats = account.maxSeats || DEFAULT_GESTORIA_SEATS

  return {
    members: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      assignedCompanyIds: user.companyAccess
        .filter((access) => access.company.kind !== "GESTORIA_PROPIA")
        .map((access) => access.company.id),
    })),
    maxSeats,
    usedSeats: users.length,
    remainingSeats: remainingSeats(maxSeats, users.length),
    clients,
  }
}

export async function inviteGestoriaTechnician(
  accountId: string,
  actorRole: UserRole,
  input: {
    name: string
    email: string
    password: string
    companyIds: string[]
  },
): Promise<GestoriaTeamMemberDto> {
  if (!canManageGestoriaTeam("GESTORIA", actorRole)) {
    throw new Error("Solo el administrador de la gestoría puede invitar técnicos.")
  }

  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  const password = input.password

  if (!name) throw new Error("El nombre del técnico es obligatorio.")
  if (!email || !email.includes("@")) throw new Error("Indica un email de empresa válido.")
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.")

  const [account, usedSeats, existing, clients] = await Promise.all([
    prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { maxSeats: true },
    }),
    prisma.user.count({ where: { accountId } }),
    prisma.user.findUnique({ where: { email } }),
    prisma.company.findMany({
      where: { accountId, kind: { not: "GESTORIA_PROPIA" } },
      select: { id: true, kind: true },
    }),
  ])

  if (existing) {
    throw new Error("Ya existe un usuario con este email.")
  }

  assertSeatAvailable(account.maxSeats || DEFAULT_GESTORIA_SEATS, usedSeats)
  const assignedIds = assignedCarteraCompanyIds(input.companyIds, clients)

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        accountId,
        name,
        email,
        passwordHash: hashPassword(password),
        role: "GESTOR",
      },
    })

    if (assignedIds.length > 0) {
      await tx.userCompanyAccess.createMany({
        data: assignedIds.map((companyId) => ({
          userId: created.id,
          companyId,
        })),
      })
    }

    return created
  })

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    assignedCompanyIds: assignedIds,
  }
}

export async function updateGestoriaTechnicianAccess(
  accountId: string,
  actorRole: UserRole,
  userId: string,
  companyIds: string[],
): Promise<GestoriaTeamMemberDto> {
  if (!canManageGestoriaTeam("GESTORIA", actorRole)) {
    throw new Error("Solo el administrador de la gestoría puede asignar cartera.")
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, accountId },
  })
  if (!user) {
    throw new Error("Usuario no encontrado.")
  }
  if (user.role !== "GESTOR") {
    throw new Error("La cartera de técnicos no se aplica al administrador.")
  }

  const clients = await prisma.company.findMany({
    where: { accountId, kind: { not: "GESTORIA_PROPIA" } },
    select: { id: true, kind: true },
  })
  const assignedIds = assignedCarteraCompanyIds(companyIds, clients)

  await prisma.$transaction(async (tx) => {
    await tx.userCompanyAccess.deleteMany({
      where: { userId },
    })
    if (assignedIds.length > 0) {
      await tx.userCompanyAccess.createMany({
        data: assignedIds.map((companyId) => ({
          userId,
          companyId,
        })),
      })
    }
  })

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    assignedCompanyIds: assignedIds,
  }
}

export async function removeGestoriaTechnician(
  accountId: string,
  actorId: string,
  actorRole: UserRole,
  userId: string,
): Promise<void> {
  if (!canManageGestoriaTeam("GESTORIA", actorRole)) {
    throw new Error("Solo el administrador de la gestoría puede eliminar técnicos.")
  }
  if (actorId === userId) {
    throw new Error("No puedes eliminar tu propio usuario.")
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, accountId },
  })
  if (!user) {
    throw new Error("Usuario no encontrado.")
  }
  if (user.role === "ADMIN_GESTOR") {
    throw new Error("No se puede eliminar al administrador de la gestoría.")
  }

  await prisma.user.delete({ where: { id: userId } })
}

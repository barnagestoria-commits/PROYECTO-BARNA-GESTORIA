import { prisma } from "@/lib/db"
import { hashPassword } from "@/lib/auth/password"
import { createEmailChallenge, verifyEmailChallenge } from "@/lib/auth/two-factor-login"

const MIN_OPERATOR_PASSWORD = 8

export async function sendOperatorPasswordCode(user: { id: string; email: string }): Promise<{ challengeId: string }> {
  const challengeId = await createEmailChallenge(user, "password")
  return { challengeId }
}

export async function confirmOperatorPassword(input: {
  userId: string
  challengeId: string
  code: string
  password: string
}): Promise<void> {
  if (input.password.length < MIN_OPERATOR_PASSWORD) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.")
  }

  const verified = await verifyEmailChallenge({
    challengeId: input.challengeId,
    code: input.code,
    rememberDevice: false,
  })
  if (verified.userId !== input.userId) {
    throw new Error("El código no corresponde a esta sesión. Pide otro.")
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: { passwordHash: hashPassword(input.password) },
  })
}

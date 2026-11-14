import { prisma } from "@/lib/db"
import {
  EMAIL_CODE_ATTEMPT_LIMIT,
  EMAIL_CODE_TTL_MS,
  emailCodeMatches,
  generateEmailCode,
  hashDeviceToken,
  hashEmailCode,
  newDeviceToken,
  trustedDeviceExpiry,
} from "@/lib/auth/email-two-factor"
import { sendLoginCodeEmail } from "@/lib/mail/send-login-code"
import { TRUSTED_DEVICE_TERMS_VERSION } from "@/lib/auth/trusted-device-terms"

export async function trustedDeviceStillValid(userId: string, token: string | null | undefined): Promise<boolean> {
  if (!token) return false
  const device = await prisma.trustedDevice.findUnique({ where: { tokenHash: hashDeviceToken(token) } })
  if (!device || device.userId !== userId || device.expiresAt <= new Date()) return false
  await prisma.trustedDevice.update({
    where: { id: device.id },
    data: { lastUsedAt: new Date() },
  })
  return true
}

export async function createEmailChallenge(user: { id: string; email: string }): Promise<string> {
  const code = generateEmailCode()
  const challenge = await prisma.emailLoginChallenge.create({
    data: {
      userId: user.id,
      codeHash: hashEmailCode(code),
      expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
    },
  })

  try {
    await sendLoginCodeEmail(user.email, code)
  } catch (error) {
    await prisma.emailLoginChallenge.delete({ where: { id: challenge.id } })
    throw error
  }

  await prisma.emailLoginChallenge.deleteMany({
    where: { userId: user.id, id: { not: challenge.id } },
  })
  return challenge.id
}

export async function verifyEmailChallenge(input: {
  challengeId: string
  code: string
  rememberDevice: boolean
}): Promise<{ userId: string; deviceToken: string | null }> {
  const challenge = await prisma.emailLoginChallenge.findUnique({ where: { id: input.challengeId } })
  if (!challenge || challenge.expiresAt <= new Date()) {
    throw new Error("El código ha caducado. Vuelve a entrar con tu correo y contraseña.")
  }
  if (challenge.attempts >= EMAIL_CODE_ATTEMPT_LIMIT) {
    throw new Error("Demasiados códigos incorrectos. Vuelve a entrar con tu correo y contraseña.")
  }
  if (!emailCodeMatches(input.code, challenge.codeHash)) {
    await prisma.emailLoginChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    })
    throw new Error("El código no es correcto.")
  }

  await prisma.emailLoginChallenge.deleteMany({ where: { userId: challenge.userId } })

  if (!input.rememberDevice) {
    return { userId: challenge.userId, deviceToken: null }
  }

  const deviceToken = newDeviceToken()
  await prisma.trustedDevice.create({
    data: {
      userId: challenge.userId,
      tokenHash: hashDeviceToken(deviceToken),
      acceptedTermsAt: new Date(),
      termsVersion: TRUSTED_DEVICE_TERMS_VERSION,
      expiresAt: trustedDeviceExpiry(),
    },
  })
  return { userId: challenge.userId, deviceToken }
}

export async function sendTwoFactorSetupCode(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
  if (!user) throw new Error("Sesión no válida.")
  await createEmailChallenge(user)
}

export async function enableEmailTwoFactor(userId: string, code: string): Promise<void> {
  const challenge = await prisma.emailLoginChallenge.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  })
  if (!challenge) {
    throw new Error("El código ha caducado. Pide otro.")
  }
  if (!emailCodeMatches(code, challenge.codeHash)) {
    throw new Error("El código no es correcto.")
  }
  await prisma.user.update({ where: { id: userId }, data: { emailTwoFactorEnabled: true } })
  await prisma.emailLoginChallenge.deleteMany({ where: { userId } })
}

export async function disableEmailTwoFactor(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { emailTwoFactorEnabled: false } })
  await prisma.emailLoginChallenge.deleteMany({ where: { userId } })
  await prisma.trustedDevice.deleteMany({ where: { userId } })
}

import nodemailer from "nodemailer"
import { mailDeliveryConfigured } from "@/lib/mail/send-login-code"

/** Correo de texto simple desde la dirección de Taxlyn. Devuelve false si no hay correo configurado. */
export async function sendPlainEmail(params: { to: string; subject: string; text: string }): Promise<boolean> {
  if (!mailDeliveryConfigured()) {
    console.warn(`[taxlyn] Correo sin enviar a ${params.to}: falta configurar SMTP.`)
    return false
  }

  const port = Number(process.env.SMTP_PORT || 587)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  })

  await transporter.sendMail({
    from: process.env.EMAIL_FROM?.trim() || "Taxlyn <infotaxlyn@gmail.com>",
    to: params.to,
    subject: params.subject,
    text: params.text,
  })
  return true
}

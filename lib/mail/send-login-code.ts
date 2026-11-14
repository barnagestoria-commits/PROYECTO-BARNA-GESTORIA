import nodemailer from "nodemailer"

export function mailDeliveryConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD,
  )
}

export async function sendLoginCodeEmail(to: string, code: string): Promise<void> {
  const text = [
    `Tu código de acceso a Taxlyn es ${code}.`,
    "Caduca en 10 minutos.",
    "Si no has intentado entrar, cambia la contraseña y escríbenos a infotaxlyn@gmail.com.",
  ].join("\n")

  if (!mailDeliveryConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[taxlyn] Código de acceso para ${to}: ${code}`)
      return
    }
    throw new Error("Ahora mismo no podemos enviar el código al correo. Escríbenos a infotaxlyn@gmail.com.")
  }

  const port = Number(process.env.SMTP_PORT || 587)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })

  await transporter.sendMail({
    from: process.env.EMAIL_FROM?.trim() || "Taxlyn <infotaxlyn@gmail.com>",
    to,
    subject: "Código de acceso a Taxlyn",
    text,
  })
}

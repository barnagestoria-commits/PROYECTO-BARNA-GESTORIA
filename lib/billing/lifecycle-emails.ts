import type { LifecycleNotice } from "@/lib/billing/access-state"

const SIGNATURE = ["", "Un saludo,", "El equipo de Taxlyn", "infotaxlyn@gmail.com"].join("\n")

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  })
}

export function buildLifecycleEmail(
  notice: LifecycleNotice,
  params: { name: string; trialEndsAt: string; deletionAt: string; appUrl: string },
): { subject: string; text: string } {
  const firstName = params.name.trim().split(/\s+/)[0]
  const hello = firstName ? `Hola ${firstName},` : "Hola,"
  const pay = `Para seguir usando Taxlyn, contrata tu plan y paga por transferencia aquí: ${params.appUrl}/checkout/transferencia`
  const download = `Para descargar tus datos, entra en Taxlyn y usa el aviso de la parte superior: ${params.appUrl}/dashboard`

  switch (notice) {
    case "trial-2d":
      return {
        subject: "Tu prueba gratuita de Taxlyn termina en 2 días",
        text: [
          hello,
          "",
          `Tu prueba gratuita termina el ${formatDate(params.trialEndsAt)}.`,
          "Después pasarás a un modo de solo lectura de 15 días en el que podrás ver y descargar tus datos, pero no modificarlos.",
          "",
          pay,
          SIGNATURE,
        ].join("\n"),
      }
    case "trial-ended":
      return {
        subject: "Tu prueba gratuita de Taxlyn ha terminado",
        text: [
          hello,
          "",
          "Tu prueba gratuita ha terminado. Tu cuenta está ahora en solo lectura.",
          `Si no contratas un plan, tu cuenta y todos sus datos se eliminarán el ${formatDate(params.deletionAt)}, sin posibilidad de recuperarlos.`,
          "",
          download,
          pay,
          SIGNATURE,
        ].join("\n"),
      }
    case "delete-7d":
      return {
        subject: "Tu cuenta de Taxlyn se eliminará en 7 días",
        text: [
          hello,
          "",
          `Tu cuenta y todos sus datos se eliminarán el ${formatDate(params.deletionAt)} si no contratas un plan.`,
          "Después no podremos recuperarlos. Descárgalos antes de esa fecha.",
          "",
          download,
          pay,
          SIGNATURE,
        ].join("\n"),
      }
    case "delete-1d":
      return {
        subject: "Último aviso: tu cuenta de Taxlyn se elimina mañana",
        text: [
          hello,
          "",
          `Mañana, ${formatDate(params.deletionAt)}, eliminaremos tu cuenta y todos sus datos.`,
          "Si necesitas tu información, descárgala hoy. Si ya has pagado, escríbenos y lo revisamos.",
          "",
          download,
          pay,
          SIGNATURE,
        ].join("\n"),
      }
  }
}

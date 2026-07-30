import type { AccountType } from "@/lib/types/auth"

export type OnboardingStepId =
  | "certificate"
  | "accounts"
  | "quick-entry"
  | "analytic"
  | "verifactu"

export type OnboardingRoleProfile = "autonomo" | "empresa" | "gestoria"

export interface OnboardingTourStepDefinition {
  id: OnboardingStepId
  route: string
  target: string
  title: string
  content: string
  placement?: "top" | "bottom" | "left" | "right" | "center" | "auto"
  /** Pasos omitidos para perfiles concretos */
  skipFor?: OnboardingRoleProfile[]
}

export interface OnboardingStatus {
  hasCompletedOnboarding: boolean
  hasCertificate: boolean
  hasFirstAccount: boolean
  recommendedStepIds: OnboardingStepId[]
  roleProfile: OnboardingRoleProfile
}

export function accountTypeToRoleProfile(accountType: AccountType): OnboardingRoleProfile {
  switch (accountType) {
    case "GESTORIA":
      return "gestoria"
    case "EMPRESA":
      return "empresa"
    default:
      return "autonomo"
  }
}

export function roleProfileLabel(profile: OnboardingRoleProfile): string {
  switch (profile) {
    case "gestoria":
      return "Gestoría"
    case "empresa":
      return "Empresa"
    default:
      return "Autónomo"
  }
}

export const ONBOARDING_STORAGE_KEY = "barna-gestoria-onboarding-v2"
export const ONBOARDING_PAUSED_KEY = "barna-gestoria-onboarding-paused"
export const ONBOARDING_START_EVENT = "barna:onboarding-start"
export const ONBOARDING_PAUSE_EVENT = "barna:onboarding-pause"
export const ONBOARDING_RESUME_EVENT = "barna:onboarding-resume"

export function getTourStepsForProfile(profile: OnboardingRoleProfile): OnboardingTourStepDefinition[] {
  const accountsStep: OnboardingTourStepDefinition =
    profile === "gestoria"
      ? {
          id: "accounts",
          route: "/dashboard/contabilidad/clientes-gestoria",
          target: '[data-tour="onboarding-new-account"]',
          title: "Cartera de clientes de la gestoría",
          content:
            "👤 **Automatiza tus asientos:** Registra aquí las empresas cliente de la gestoría. Al abrir cada ficha podrás definir plan contable, impresos y parametrización habitual para agilizar la contabilización.",
          placement: "bottom",
        }
      : {
          id: "accounts",
          route: "/dashboard/contactos",
          target: '[data-tour="onboarding-new-account"]',
          title: "Clientes, proveedores y contrapartidas",
          content:
            "👤 **Automatiza tus asientos:** Al crear un cliente o proveedor, define su cuenta de gasto/ingreso habitual, % de IVA e IRPF por defecto para que las facturas se desglosen solas.",
          placement: "bottom",
        }

  const baseSteps: OnboardingTourStepDefinition[] = [
    {
      id: "certificate",
      route: "/configuracion/certificado",
      target: '[data-tour="onboarding-certificate"]',
      title: "Configuración fiscal y certificado digital",
      content:
        "🔐 **Primer paso clave:** Sube aquí tu certificado digital (.p12/.pfx) para habilitar la firma inalterable y la comunicación automática con Verifactu/AEAT.",
      placement: "bottom",
    },
    accountsStep,
    {
      id: "quick-entry",
      route: "/dashboard/contabilidad",
      target: '[data-tour="onboarding-entry-form"]',
      title: "Entrada rápida de asientos",
      content:
        "⚡ **Entrada rápida con teclado:** Utiliza TAB para avanzar. El cursor saltará al Debe o Haber según la cuenta. Usa F4 para buscar por nombre o F6 por NIF.",
      placement: "bottom",
    },
    {
      id: "analytic",
      route: "/dashboard/contabilidad",
      target: '[data-tour="onboarding-analytic"]',
      title: "Contabilidad analítica",
      content:
        "📊 **Control por departamentos:** Imputa importes por porcentaje o valor fijo a tus centros de coste para obtener balances desglosados.",
      placement: "left",
    },
    {
      id: "verifactu",
      route: "/dashboard/ventas/facturas-emitidas",
      target: '[data-tour="onboarding-verifactu"]',
      title: "Verifactu y factura PDF",
      content:
        "🧾 **Cumplimiento legal:** Todas tus facturas emitidas incluirán el código QR oficial y la huella de registro inalterable para la AEAT.",
      placement: "bottom",
      skipFor: ["gestoria"],
    },
  ]

  return baseSteps.filter((step) => !step.skipFor?.includes(profile))
}

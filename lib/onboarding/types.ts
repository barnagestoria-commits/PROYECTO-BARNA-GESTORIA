import type { AccountType } from "@/lib/types/auth"

export type OnboardingStepId =
  | "profile"
  | "certificate"
  | "census"
  | "profile-rest"
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
      id: "profile",
      route: "/configuracion",
      target: '[data-tour="onboarding-profile"]',
      title: "La ficha empieza en el perfil",
      content:
        "📋 **Aquí nace la ficha fiscal.** El nombre, el NIF y el CNAE de esta pantalla son los que luego usan los modelos. El orden es: certificado digital, modelo 036 y el resto de datos del perfil.",
      placement: "bottom",
    },
    {
      id: "certificate",
      route: "/configuracion/certificado",
      target: '[data-tour="onboarding-certificate"]',
      title: "Certificado digital",
      content:
        "🔐 **Primer documento:** Sube el certificado .p12 o .pfx y su contraseña. Con él se firma y se presenta ante la AEAT. El archivo no se guarda: solo el NIF y el titular.",
      placement: "bottom",
    },
    {
      id: "census",
      route: "/configuracion",
      target: '[data-tour="onboarding-census"]',
      title: "Modelo 036 o certificado censal",
      content:
        "📄 **Segundo documento:** Sube el PDF del modelo 036, del 037 o del certificado de situación censal. Se contrasta con el NIF, el CNAE y el tipo de sociedad de la ficha.",
      placement: "top",
    },
    {
      id: "profile-rest",
      route: "/configuracion",
      target: '[data-tour="onboarding-profile-rest"]',
      title: "Completa el resto de la ficha",
      content:
        "✅ **Cierra el perfil:** Fecha de alta, SII, criterio de caja y la cuenta donde Hacienda puede cargar los impuestos. Pulsa el lápiz, rellena y guarda.",
      placement: "top",
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

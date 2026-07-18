import { DEFAULT_APP_URL } from "./app-url"

export const NATIVE_APP_CONFIG = {
  appDisplayName: "Gestoría",
  bundleId: "com.gestoria.platform",
  defaultCloudAppUrl: DEFAULT_APP_URL,
  legalPaths: {
    privacyPolicy: "/politica-privacidad",
    termsOfService: "/terminos-servicio",
  },
} as const

export type NativeAppConfig = typeof NATIVE_APP_CONFIG

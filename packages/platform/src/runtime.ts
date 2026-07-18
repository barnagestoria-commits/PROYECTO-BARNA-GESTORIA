export type AppRuntime = "web" | "desktop" | "mobile"

declare global {
  interface Window {
    __TAURI__?: unknown
    __GESTORIA_RUNTIME__?: AppRuntime
    Capacitor?: {
      isNativePlatform?: () => boolean
      getPlatform?: () => string
    }
  }
}

function isTauriShell(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window
}

function isCapacitorShell(): boolean {
  if (typeof window === "undefined") return false
  return window.Capacitor?.isNativePlatform?.() === true
}

/** Detecta si la UI corre en navegador, shell de escritorio (Tauri) o app móvil (Capacitor). */
export function getAppRuntime(): AppRuntime {
  if (typeof window === "undefined") return "web"

  const injected = window.__GESTORIA_RUNTIME__
  if (injected === "desktop" || injected === "mobile" || injected === "web") {
    return injected
  }

  if (isTauriShell()) return "desktop"
  if (isCapacitorShell()) return "mobile"
  return "web"
}

export function isDesktopShell(): boolean {
  return getAppRuntime() === "desktop"
}

export function isMobileShell(): boolean {
  return getAppRuntime() === "mobile"
}

export function isWebBrowser(): boolean {
  return getAppRuntime() === "web"
}

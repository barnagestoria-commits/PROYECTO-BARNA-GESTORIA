#!/usr/bin/env node
/**
 * Sincroniza URL cloud y bundle id desde env + packages/platform/native-app.config.json
 * hacia Capacitor y Tauri. Ejecutar tras cambiar NEXT_PUBLIC_APP_URL en producción.
 *
 * Uso: npm run native:config
 *      NEXT_PUBLIC_APP_URL=https://tu-dominio.com npm run native:config
 */

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const nativeConfigPath = join(root, "packages/platform/native-app.config.json")
const nativeConfig = JSON.parse(readFileSync(nativeConfigPath, "utf8"))

function loadEnvLocal() {
  try {
    const envPath = join(root, ".env.local")
    const content = readFileSync(envPath, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env.local opcional
  }
}

function normalizeOrigin(value) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`
  try {
    return new URL(candidate).origin
  } catch {
    return null
  }
}

loadEnvLocal()

const cloudUrl =
  normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
  normalizeOrigin(process.env.NEXTAUTH_URL) ||
  nativeConfig.defaultCloudAppUrl

const bundleId = nativeConfig.bundleId
const appName = nativeConfig.appDisplayName

// Capacitor
const capacitorPath = join(root, "apps/mobile/capacitor.config.json")
const capacitor = JSON.parse(readFileSync(capacitorPath, "utf8"))
capacitor.appId = bundleId
capacitor.appName = appName
capacitor.server = {
  ...capacitor.server,
  url: cloudUrl,
  cleartext: false,
  androidScheme: "https",
}
writeFileSync(capacitorPath, `${JSON.stringify(capacitor, null, 2)}\n`)

// Tauri
const tauriPath = join(root, "apps/desktop/src-tauri/tauri.conf.json")
const tauri = JSON.parse(readFileSync(tauriPath, "utf8"))
tauri.productName = appName
tauri.identifier = bundleId
tauri.build.devUrl = cloudUrl
if (tauri.app?.windows?.[0]) {
  tauri.app.windows[0].title = appName
  tauri.app.windows[0].url = cloudUrl
}
writeFileSync(tauriPath, `${JSON.stringify(tauri, null, 2)}\n`)

console.log(`native:config → cloud URL: ${cloudUrl}`)
console.log(`native:config → bundle id: ${bundleId}`)
console.log("Actualizados: apps/mobile/capacitor.config.json, apps/desktop/src-tauri/tauri.conf.json")

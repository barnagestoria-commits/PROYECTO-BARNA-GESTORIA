import { createHash } from "crypto"
import { describe, expect, it } from "vitest"
import {
  LOGIN_FAILURE_LIMIT,
  nextLoginGuard,
  operatorEmailChangeError,
} from "@/lib/auth/login-guard"
import { hashPassword, passwordNeedsRehash, verifyPassword } from "@/lib/auth/password"

describe("contraseña", () => {
  it("guarda con scrypt y reconoce el hash antiguo", () => {
    const stored = hashPassword("clave-larga-del-operador")
    expect(stored.startsWith("scrypt:")).toBe(true)
    expect(verifyPassword("clave-larga-del-operador", stored)).toBe(true)
    expect(verifyPassword("otra", stored)).toBe(false)
    expect(passwordNeedsRehash(stored)).toBe(false)

    const salt = "abc123"
    const legacy = createHash("sha256").update(`${salt}:secreta`).digest("hex")
    expect(verifyPassword("secreta", `${salt}:${legacy}`)).toBe(true)
    expect(passwordNeedsRehash(`${salt}:${legacy}`)).toBe(true)
  })
})

describe("guarda de acceso del operador", () => {
  it("pausa el correo del operador media hora al quinto fallo", () => {
    const now = Date.parse("2026-11-14T08:00:00.000Z")
    const fourth = nextLoginGuard(3, now, true)
    expect(fourth.lockedUntil).toBeNull()
    const fifth = nextLoginGuard(4, now, true)
    expect(fifth.failures).toBe(LOGIN_FAILURE_LIMIT)
    expect(fifth.lockedUntil).toBe(now + 30 * 60 * 1000)
  })

  it("reserva el correo del operador", () => {
    expect(operatorEmailChangeError("juan@empresa.com", "infotaxlyn@gmail.com")).toMatch(/reservado/)
    expect(operatorEmailChangeError("infotaxlyn@gmail.com", "otro@gmail.com")).toMatch(/no se cambia/)
    expect(operatorEmailChangeError("juan@empresa.com", "juan@empresa.com")).toBeNull()
  })
})

import { describe, expect, it } from "vitest"
import {
  matchOcrShortcut,
  parseOcrSettings,
  serializeOcrSettings,
  validateOcrShortcuts,
} from "@/lib/ocr/ocr-settings"

describe("ocr-settings", () => {
  it("usa F4 y F12 por defecto", () => {
    const settings = parseOcrSettings(null)
    expect(settings.blockDuplicates).toBe(true)
    expect(settings.isolateCurrentInvoice).toBe(true)
    expect(settings.shortcuts.map((item) => `${item.action}:${item.key}`)).toEqual([
      "confirm:F4",
      "skip:F12",
    ])
  })

  it("detecta teclas duplicadas entre acciones distintas", () => {
    expect(
      validateOcrShortcuts([
        { id: "a", action: "confirm", key: "F4" },
        { id: "b", action: "skip", key: "F4" },
      ]),
    ).toMatch(/F4/)
  })

  it("reconoce el comando pulsado", () => {
    const settings = parseOcrSettings(
      serializeOcrSettings({
        blockDuplicates: true,
        requireTotalsMatch: false,
        requireCif: false,
        isolateCurrentInvoice: true,
        shortcuts: [{ id: "c", action: "discard", key: "F8" }],
      }),
    )
    const event = { key: "F8", altKey: false } as KeyboardEvent
    expect(matchOcrShortcut(settings.shortcuts, event)).toBe("discard")
  })
})

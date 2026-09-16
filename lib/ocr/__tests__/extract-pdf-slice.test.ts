import { describe, expect, it } from "vitest"
import { clampPageRange } from "@/lib/ocr/extract-pdf-slice"

describe("clampPageRange", () => {
  it("keeps a single ticket page inside a multi-page PDF", () => {
    expect(clampPageRange(3, 3, 13)).toEqual({ from: 3, to: 3 })
  })

  it("clamps inverted or oversized ranges", () => {
    expect(clampPageRange(12, 40, 13)).toEqual({ from: 12, to: 13 })
    expect(clampPageRange(0, 2, 8)).toEqual({ from: 1, to: 2 })
  })
})

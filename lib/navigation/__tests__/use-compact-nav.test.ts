import { describe, expect, it } from "vitest"
import { DESKTOP_NAV_MEDIA_QUERY } from "@/lib/navigation/use-compact-nav"

describe("desktop vs compact navigation query", () => {
  it("requires mouse hover, a wide viewport and enough height", () => {
    expect(DESKTOP_NAV_MEDIA_QUERY).toContain("(hover: hover)")
    expect(DESKTOP_NAV_MEDIA_QUERY).toContain("(pointer: fine)")
    expect(DESKTOP_NAV_MEDIA_QUERY).toContain("(min-width: 768px)")
    expect(DESKTOP_NAV_MEDIA_QUERY).toContain("(min-height: 520px)")
  })
})

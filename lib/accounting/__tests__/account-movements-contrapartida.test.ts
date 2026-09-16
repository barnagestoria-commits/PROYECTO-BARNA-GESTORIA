import { describe, expect, it } from "vitest"
import { formatContrapartida } from "@/lib/accounting/account-movements-service"

describe("formatContrapartida", () => {
  it("lists every distinct counterpart account, not only the first", () => {
    expect(
      formatContrapartida(
        [
          { cuenta: "410.0003" },
          { cuenta: "472" },
          { cuenta: "628.0001" },
        ],
        "4100003",
      ),
    ).toBe("472 · 628.0001")
  })

  it("does not repeat the same counterpart twice", () => {
    expect(
      formatContrapartida(
        [
          { cuenta: "410.0003" },
          { cuenta: "472" },
          { cuenta: "472" },
        ],
        "410.0003",
      ),
    ).toBe("472")
  })

  it("returns null when there is no counterpart", () => {
    expect(formatContrapartida([{ cuenta: "410.0003" }], "4100003")).toBeNull()
  })
})

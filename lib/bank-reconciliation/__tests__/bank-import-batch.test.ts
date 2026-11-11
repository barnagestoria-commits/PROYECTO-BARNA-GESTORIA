import { describe, expect, it } from "vitest"
import { prepareBankMovementsForInsert } from "@/lib/bank-reconciliation/bank-import-service"
import { parseBankCsvBuffer } from "@/lib/bank-reconciliation/parse-bank-spreadsheet"
import { chunkArray } from "@/lib/storage/batch"
import { MAX_BANK_WARNINGS } from "@/lib/storage/upload-limits"

describe("bank import batching", () => {
  it("chunks inserts so large extracts do not hit Postgres in a single round-trip", () => {
    const rows = Array.from({ length: 1250 }, (_, index) => index)
    expect(chunkArray(rows, 400)).toHaveLength(4)
    expect(chunkArray(rows, 400)[3]).toHaveLength(50)
  })

  it("dedupes by key without needing the whole company movement table in memory", () => {
    const movements = [
      { movementDate: "2026-01-02", concept: "Alquiler", amount: -800 },
      { movementDate: "2026-01-02", concept: "Alquiler", amount: -800 },
      { movementDate: "2026-01-03", concept: "Ingreso cliente", amount: 1210 },
    ]
    const existing = new Set<string>()
    const first = prepareBankMovementsForInsert(movements, existing)
    expect(first.toInsert).toHaveLength(2)
    expect(first.duplicatesSkipped).toBe(1)

    const second = prepareBankMovementsForInsert(movements, existing)
    expect(second.toInsert).toHaveLength(0)
    expect(second.duplicatesSkipped).toBe(3)
  })

  it("caps parse warnings so a dirty CSV does not explode the preview payload", () => {
    const header = "fecha;concepto;importe"
    const badRows = Array.from({ length: 80 }, () => "fecha-mala;x;no-numero")
    const good = "01/01/2026;Pago luz;12,50"
    const preview = parseBankCsvBuffer(
      Buffer.from([header, ...badRows, good].join("\n"), "utf8"),
      "extracto.csv",
    )
    expect(preview.movements).toHaveLength(1)
    expect(preview.warnings.length).toBeLessThanOrEqual(MAX_BANK_WARNINGS + 1)
  })
})

import { describe, expect, it } from "vitest"
import {
  assertCompanyStorageKey,
  buildCompanyStorageKey,
  sanitizeStorageFileName,
} from "@/lib/storage/object-storage"

describe("object storage keys", () => {
  it("strips path separators and odd characters from file names", () => {
    expect(sanitizeStorageFileName("../../etc/passwd.pdf")).toBe("passwd.pdf")
    expect(sanitizeStorageFileName("Extracto Banco (BBVA) 2026.xlsx")).toBe("Extracto_Banco_BBVA_2026.xlsx")
  })

  it("prefixes keys with company and kind so tenants cannot collide", () => {
    const key = buildCompanyStorageKey("emp_1", "bank-statements", "extracto.csv")
    expect(key.startsWith("taxlyn/emp_1/bank-statements/")).toBe(true)
    expect(key.endsWith("extracto.csv")).toBe(true)
  })

  it("rejects keys that belong to another company or kind", () => {
    const key = "taxlyn/emp_1/documents/2026/abc-factura.pdf"
    expect(() => assertCompanyStorageKey("emp_1", key, "documents")).not.toThrow()
    expect(() => assertCompanyStorageKey("emp_2", key, "documents")).toThrow(/no pertenece/)
    expect(() => assertCompanyStorageKey("emp_1", key, "certificates")).toThrow(/no pertenece/)
    expect(() => assertCompanyStorageKey("emp_1", "../taxlyn/emp_1/documents/x")).toThrow()
  })
})

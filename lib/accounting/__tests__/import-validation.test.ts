import { describe, expect, it } from "vitest"
import {
  aggregateAccountTotals,
  compareAccountTotals,
  detectGenericAccountUsage,
  detectUnlinkedSubaccounts,
  validateAllEntriesBalanced,
  validateA3ImportPreview,
  summarizeImportValidation,
} from "@/lib/accounting/import-validation"
import type { A3ImportPreview, A3JournalEntry } from "@/lib/imports/a3/types"

function balancedEntry(overrides?: Partial<A3JournalEntry>): A3JournalEntry {
  return {
    fecha: "2025-01-15",
    documento: "FRA001",
    concepto: "Factura servicios",
    recordTypes: ["0"],
    lines: [
      { fecha: "2025-01-15", cuenta: "629000000003", concepto: "Gasto", debe: 100, haber: 0 },
      { fecha: "2025-01-15", cuenta: "472000000001", concepto: "IVA", debe: 21, haber: 0 },
      { fecha: "2025-01-15", cuenta: "400000000523", concepto: "Proveedor", debe: 0, haber: 121 },
    ],
    ...overrides,
  }
}

describe("import-validation", () => {
  describe("validateAllEntriesBalanced", () => {
    it("no reporta errores en asientos equilibrados", () => {
      expect(validateAllEntriesBalanced([balancedEntry()])).toHaveLength(0)
    })

    it("detecta asientos desequilibrados", () => {
      const issues = validateAllEntriesBalanced([
        balancedEntry({
          lines: [
            { fecha: "2025-01-15", cuenta: "629000000003", concepto: "Gasto", debe: 100, haber: 0 },
            { fecha: "2025-01-15", cuenta: "400000000523", concepto: "Proveedor", debe: 0, haber: 90 },
          ],
        }),
      ])

      expect(issues).toHaveLength(1)
      expect(issues[0].code).toBe("UNBALANCED_ENTRY")
      expect(issues[0].severity).toBe("error")
    })
  })

  describe("detectGenericAccountUsage", () => {
    it("avisa cuando el diario usa cuentas genéricas inferidas", () => {
      const entry = balancedEntry({
        lines: [
          { fecha: "2025-01-15", cuenta: "629000000000", concepto: "Gasto genérico", debe: 500, haber: 0 },
          { fecha: "2025-01-15", cuenta: "400000000000", concepto: "Proveedor genérico", debe: 0, haber: 500 },
        ],
      })

      const issues = detectGenericAccountUsage([entry])
      expect(issues.some((issue) => issue.code === "GENERIC_ACCOUNT_CODE" && issue.cuenta === "629000000000")).toBe(
        true,
      )
    })

    it("no avisa cuando se usan subcuentas específicas", () => {
      expect(detectGenericAccountUsage([balancedEntry()])).toHaveLength(0)
    })
  })

  describe("detectUnlinkedSubaccounts", () => {
    it("detecta subcuentas del plan no enlazadas al diario genérico", () => {
      const entry = balancedEntry({
        lines: [
          { fecha: "2025-01-15", cuenta: "629000000000", concepto: "Gasto", debe: 100, haber: 0 },
          { fecha: "2025-01-15", cuenta: "400000000000", concepto: "Proveedor", debe: 0, haber: 100 },
        ],
      })

      const issues = detectUnlinkedSubaccounts([entry], [
        { accountCode: "629000000003", name: "Servicios IT" },
        { accountCode: "629000000007", name: "Marketing" },
      ])

      expect(issues.some((issue) => issue.code === "SUBACCOUNT_NOT_LINKED")).toBe(true)
      expect(issues.some((issue) => issue.cuenta === "629000000003")).toBe(true)
    })

    it("no reporta subcuentas enlazadas correctamente", () => {
      const issues = detectUnlinkedSubaccounts([balancedEntry()], [
        { accountCode: "629000000003", name: "Servicios" },
      ])

      expect(issues.filter((issue) => issue.code === "SUBACCOUNT_NOT_LINKED")).toHaveLength(0)
    })
  })

  describe("aggregateAccountTotals", () => {
    it("suma debe/haber por cuenta exacta", () => {
      const totals = aggregateAccountTotals([
        balancedEntry(),
        balancedEntry({
          documento: "FRA002",
          lines: [
            { fecha: "2025-01-15", cuenta: "629000000003", concepto: "Gasto", debe: 50, haber: 0 },
            { fecha: "2025-01-15", cuenta: "400000000523", concepto: "Proveedor", debe: 0, haber: 50 },
          ],
        }),
      ])

      const gasto = totals.find((row) => row.cuenta === "629000000003")
      expect(gasto?.totalDebe).toBe(150)
      expect(gasto?.saldo).toBe(150)
    })
  })

  describe("compareAccountTotals", () => {
    it("detecta diferencias de saldo por cuenta", () => {
      const expected = aggregateAccountTotals([balancedEntry()])
      const actual = aggregateAccountTotals([
        balancedEntry({
          lines: [
            { fecha: "2025-01-15", cuenta: "629000000003", concepto: "Gasto", debe: 90, haber: 0 },
            { fecha: "2025-01-15", cuenta: "400000000523", concepto: "Proveedor", debe: 0, haber: 90 },
          ],
        }),
      ])

      const issues = compareAccountTotals(expected, actual)
      expect(issues.some((issue) => issue.code === "ACCOUNT_TOTAL_MISMATCH")).toBe(true)
    })
  })

  describe("validateA3ImportPreview", () => {
    it("combina validaciones de equilibrio, genéricas y subcuentas", () => {
      const preview: A3ImportPreview = {
        versionLabel: "test",
        companyCode: "00001",
        fiscalYear: 2025,
        entryCount: 1,
        subaccountCount: 1,
        newSubaccountCount: 1,
        thirdPartyCount: 0,
        newThirdPartyCount: 0,
        recordTypes: ["0"],
        contents: {
          fileNames: [],
          subaccountSource: null,
          journalSource: null,
          linkFormat: "suenlace-v950",
          importMode: "suenlace-matrix",
        },
        entries: [
          balancedEntry({
            lines: [
              { fecha: "2025-01-15", cuenta: "629000000000", concepto: "Gasto", debe: 100, haber: 0 },
              { fecha: "2025-01-15", cuenta: "400000000000", concepto: "Proveedor", debe: 0, haber: 100 },
            ],
          }),
        ],
        subaccounts: [{ accountCode: "629000000003", name: "Servicios" }],
        thirdParties: [],
        warnings: [],
      }

      const issues = validateA3ImportPreview(preview)
      const summary = summarizeImportValidation(issues)

      expect(summary.warningCount).toBeGreaterThan(0)
      expect(summary.errorCount).toBeGreaterThan(0)
      expect(summary.isValid).toBe(false)
    })
  })
})

import { describe, expect, it } from "vitest"
import {
  defaultModel303ExportPayment,
  isModel303DirectDebitOpen,
  resolveModel303FileOptions,
} from "@/lib/fiscal/model-303/export-payment"

describe("model 303 payment window", () => {
  it("closes direct debit for the third quarter on 16 October", () => {
    const period = {
      year: 2026,
      quarter: 3 as const,
      now: new Date("2026-10-15T22:30:00.000Z"),
    }

    expect(isModel303DirectDebitOpen(period)).toBe(false)
    expect(defaultModel303ExportPayment(370.92, period, true)).toBe("solicitud_nrc")
    expect(
      resolveModel303FileOptions({
        payment: "solicitud_nrc",
        resultAmount: 370.92,
        taxDirectDebitIban: "ES9501824170020201923616",
        period,
      }).options,
    ).toEqual({})
    expect(
      resolveModel303FileOptions({
        payment: "domiciliacion",
        resultAmount: 370.92,
        taxDirectDebitIban: "ES9501824170020201923616",
        period,
      }).error,
    ).toMatch(/15 de octubre de 2026/)
  })

  it("keeps direct debit open on 15 October in Spain", () => {
    const period = {
      year: 2026,
      quarter: 3 as const,
      now: new Date("2026-10-15T21:30:00.000Z"),
    }

    expect(isModel303DirectDebitOpen(period)).toBe(true)
    expect(defaultModel303ExportPayment(370.92, period, true)).toBe("domiciliacion")
  })
})

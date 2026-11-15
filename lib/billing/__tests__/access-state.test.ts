import { describe, expect, it } from "vitest"
import {
  ACCESS_BLOCKED_MESSAGE,
  computeAccountAccess,
  deletionDate,
  dueLifecycleNotice,
  isRequestAllowedForPhase,
  trialEndDate,
} from "@/lib/billing/access-state"

const DAY = 24 * 60 * 60 * 1000
const start = new Date("2026-11-15T10:00:00.000Z")
const trialEndsAt = trialEndDate(start)
const at = (days: number) => new Date(start.getTime() + days * DAY)
const trial = { accessStatus: "TRIAL" as const, trialEndsAt }

describe("computeAccountAccess", () => {
  it("treats accounts without a trial as active", () => {
    expect(computeAccountAccess({ accessStatus: "ACTIVE", trialEndsAt: null }, at(100)).phase).toBe("active")
    expect(computeAccountAccess({ accessStatus: "TRIAL", trialEndsAt: null }, at(100)).phase).toBe("active")
    expect(computeAccountAccess({}, at(100)).phase).toBe("active")
  })

  it("is trial for 7 days, then readonly for 15, then expired", () => {
    expect(computeAccountAccess(trial, at(0)).phase).toBe("trial")
    expect(computeAccountAccess(trial, at(0)).daysLeft).toBe(7)
    expect(computeAccountAccess(trial, at(6.5)).daysLeft).toBe(1)
    expect(computeAccountAccess(trial, at(7)).phase).toBe("readonly")
    expect(computeAccountAccess(trial, at(7)).daysUntilDeletion).toBe(15)
    expect(computeAccountAccess(trial, at(21.5)).daysUntilDeletion).toBe(1)
    expect(computeAccountAccess(trial, at(22)).phase).toBe("expired")
  })

  it("deletes 15 days after the trial ends", () => {
    expect(deletionDate(trialEndsAt).getTime() - trialEndsAt.getTime()).toBe(15 * DAY)
  })
})

describe("isRequestAllowedForPhase", () => {
  it("allows everything while active or in trial", () => {
    expect(isRequestAllowedForPhase("trial", "POST", "/api/accounting/entries")).toBe(true)
    expect(isRequestAllowedForPhase("active", "DELETE", "/api/documents/1")).toBe(true)
  })

  it("only allows reads, checkout and account routes in readonly", () => {
    expect(isRequestAllowedForPhase("readonly", "GET", "/api/accounting/entries")).toBe(true)
    expect(isRequestAllowedForPhase("readonly", "POST", "/api/accounting/entries")).toBe(false)
    expect(isRequestAllowedForPhase("readonly", "DELETE", "/api/documents/1")).toBe(false)
    expect(isRequestAllowedForPhase("readonly", "POST", "/api/invoices/ocr")).toBe(false)
    expect(isRequestAllowedForPhase("readonly", "POST", "/api/checkout/transferencia")).toBe(true)
    expect(isRequestAllowedForPhase("readonly", "POST", "/api/account/upgrade")).toBe(true)
    expect(isRequestAllowedForPhase("expired", "POST", "/api/accounting/entries")).toBe(false)
    expect(ACCESS_BLOCKED_MESSAGE).toContain("solo lectura")
  })
})

describe("dueLifecycleNotice", () => {
  it("warns two days before the trial ends, once", () => {
    expect(dueLifecycleNotice(computeAccountAccess(trial, at(3)), [])).toBeNull()
    expect(dueLifecycleNotice(computeAccountAccess(trial, at(5.5)), [])).toBe("trial-2d")
    expect(dueLifecycleNotice(computeAccountAccess(trial, at(5.5)), ["trial-2d"])).toBeNull()
  })

  it("sends trial-ended, then 7 days and 1 day before deletion", () => {
    expect(dueLifecycleNotice(computeAccountAccess(trial, at(8)), [])).toBe("trial-ended")
    expect(dueLifecycleNotice(computeAccountAccess(trial, at(8)), ["trial-ended"])).toBeNull()
    expect(dueLifecycleNotice(computeAccountAccess(trial, at(15)), ["trial-ended"])).toBe("delete-7d")
    expect(dueLifecycleNotice(computeAccountAccess(trial, at(21.2)), ["trial-ended", "delete-7d"])).toBe("delete-1d")
    expect(dueLifecycleNotice(computeAccountAccess(trial, at(21.2)), ["trial-ended", "delete-7d", "delete-1d"])).toBeNull()
  })

  it("sends nothing to active accounts", () => {
    expect(dueLifecycleNotice(computeAccountAccess({ accessStatus: "ACTIVE" }, at(50)), [])).toBeNull()
  })
})

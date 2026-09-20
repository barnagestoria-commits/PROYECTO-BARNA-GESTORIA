import { describe, expect, it } from "vitest"
import {
  assignedCarteraCompanyIds,
  assertSeatAvailable,
  canManageGestoriaTeam,
  canSeeGestoriaInternalBooks,
  gestoriaCompanyOptionLabel,
  remainingSeats,
  selectCompaniesVisibleToUser,
} from "@/lib/auth/gestoria-access"
import { resolveActiveCompanyId } from "@/lib/auth/permissions"
import type { CompanySummary } from "@/lib/types/auth"

const propia: CompanySummary = {
  id: "propia",
  name: "Barna Gestoría",
  cif: "B00000000",
  kind: "GESTORIA_PROPIA",
}

const clientA: CompanySummary = {
  id: "client-a",
  name: "Italians Do It Better",
  cif: "B11111111",
  kind: "CLIENTE_CARTERA",
}

const clientB: CompanySummary = {
  id: "client-b",
  name: "Zinco Business",
  cif: "B22222222",
  kind: "CLIENTE_CARTERA",
}

describe("gestoria workspace access", () => {
  it("lets the admin see the internal company and the full portfolio", () => {
    const visible = selectCompaniesVisibleToUser({
      accountType: "GESTORIA",
      role: "ADMIN_GESTOR",
      companies: [propia, clientA, clientB],
      assignedCompanyIds: [clientA.id],
    })

    expect(visible.map((company) => company.id)).toEqual(["propia", "client-a", "client-b"])
    expect(canSeeGestoriaInternalBooks("GESTORIA", "ADMIN_GESTOR")).toBe(true)
    expect(canManageGestoriaTeam("GESTORIA", "ADMIN_GESTOR")).toBe(true)
  })

  it("hides the gestoría books from technicians and keeps only assigned clients", () => {
    const visible = selectCompaniesVisibleToUser({
      accountType: "GESTORIA",
      role: "GESTOR",
      companies: [propia, clientA, clientB],
      assignedCompanyIds: [clientA.id, propia.id],
    })

    expect(visible).toEqual([clientA])
    expect(canSeeGestoriaInternalBooks("GESTORIA", "GESTOR")).toBe(false)
    expect(canManageGestoriaTeam("GESTORIA", "GESTOR")).toBe(false)
  })

  it("does not give a technician the whole portfolio when they have no assignments", () => {
    const visible = selectCompaniesVisibleToUser({
      accountType: "GESTORIA",
      role: "GESTOR",
      companies: [propia, clientA, clientB],
      assignedCompanyIds: null,
    })

    expect(visible).toEqual([])
  })

  it("does not change autonomo or empresa company lists", () => {
    const company: CompanySummary = {
      id: "solo",
      name: "Juan Pérez",
      cif: "12345678Z",
      kind: "STANDARD",
    }

    expect(
      selectCompaniesVisibleToUser({
        accountType: "CLIENTE_FINAL",
        role: "CLIENTE",
        companies: [company],
        assignedCompanyIds: null,
      }),
    ).toEqual([company])
  })

  it("labels the internal company in selectors and prefers a client as default", () => {
    expect(gestoriaCompanyOptionLabel(propia)).toBe("Gestoría · Barna Gestoría")
    expect(gestoriaCompanyOptionLabel(clientA)).toBe("Italians Do It Better")
    expect(resolveActiveCompanyId([propia, clientA])).toBe("client-a")
    expect(resolveActiveCompanyId([propia, clientA], "propia")).toBe("propia")
  })

  it("never assigns the internal company to a technician seat", () => {
    expect(assignedCarteraCompanyIds(["propia", "client-a"], [propia, clientA])).toEqual(["client-a"])
  })

  it("enforces eight named seats on the gestoría license", () => {
    expect(remainingSeats(8, 3)).toBe(5)
    expect(() => assertSeatAvailable(8, 8)).toThrow(/máximo 8 usuarios/)
  })
})

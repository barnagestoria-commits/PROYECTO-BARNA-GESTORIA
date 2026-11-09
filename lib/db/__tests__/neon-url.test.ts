import { describe, expect, it } from "vitest"
import { isTransientPrismaError, withNeonPoolerParams } from "@/lib/db/neon-url"

describe("neon pooled url", () => {
  it("adds pgbouncer to Neon pooler hosts without dropping credentials", () => {
    const input =
      "postgresql://taxlyn:secret@ep-demo-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require"
    const output = withNeonPoolerParams(input)
    const url = new URL(output)
    expect(url.searchParams.get("pgbouncer")).toBe("true")
    expect(url.searchParams.get("connect_timeout")).toBe("15")
    expect(url.searchParams.get("sslmode")).toBe("require")
    expect(url.password).toBe("secret")
  })

  it("leaves a direct Neon host unchanged", () => {
    const input =
      "postgresql://taxlyn:secret@ep-demo.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require"
    expect(withNeonPoolerParams(input)).toBe(input)
  })

  it("retries closed Prisma connections", () => {
    expect(isTransientPrismaError({ code: "P1017", message: "Server has closed the connection." })).toBe(
      true,
    )
    expect(isTransientPrismaError(new Error("Error { kind: Closed, cause: None }"))).toBe(true)
    expect(isTransientPrismaError(new Error("Unique constraint failed"))).toBe(false)
  })
})

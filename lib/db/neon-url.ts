/** Neon pooler needs Prisma's pgbouncer flag or idle connections drop as "Closed". */
export function withNeonPoolerParams(databaseUrl: string): string {
  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    return databaseUrl
  }

  const isPooler =
    parsed.hostname.includes("-pooler") ||
    parsed.port === "6543" ||
    parsed.searchParams.get("pgbouncer") === "true"

  if (!isPooler) return databaseUrl

  if (!parsed.searchParams.has("pgbouncer")) {
    parsed.searchParams.set("pgbouncer", "true")
  }
  if (!parsed.searchParams.has("connect_timeout")) {
    parsed.searchParams.set("connect_timeout", "15")
  }

  return parsed.toString()
}

export function isTransientPrismaError(error: unknown): boolean {
  const code =
    typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : ""
  const message = error instanceof Error ? error.message : String(error)

  return (
    code === "P1001" ||
    code === "P1017" ||
    code === "P2024" ||
    /kind: Closed|Can't reach database|Connection reset|connection closed|Server has closed|Timed out fetching a new connection/i.test(
      message,
    )
  )
}

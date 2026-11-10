import { PrismaClient } from "@prisma/client"
import { isTransientPrismaError, withNeonPoolerParams } from "@/lib/db/neon-url"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

const datasourceUrl = process.env.DATABASE_URL
  ? withNeonPoolerParams(process.env.DATABASE_URL)
  : undefined

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
  })

  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args)
        } catch (error) {
          if (!isTransientPrismaError(error)) throw error
          await client.$connect()
          return query(args)
        }
      },
    },
  }) as unknown as PrismaClient
}

function loadPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

/** Nunca instanciar Prisma en el navegador: el asiento rápido importa helpers de facturas duplicadas. */
export const prisma =
  typeof window === "undefined" ? loadPrisma() : (null as unknown as PrismaClient)

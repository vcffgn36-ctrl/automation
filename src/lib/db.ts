import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Keep logging quiet to save memory in the sandbox.
    log: [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
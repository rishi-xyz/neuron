import { PrismaClient } from "@prisma/client";

const isDev = process.env.NODE_ENV !== "production";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ["query", "info", "warn", "error"] : ["error"],
  });

if (isDev) {
  console.log("[db] PrismaClient initialized (development mode)");
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export type * from "@prisma/client";

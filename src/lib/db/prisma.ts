import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseUrl, isDatabaseConfigured } from "@/lib/db/database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export { isDatabaseConfigured };

export function getPrisma() {
  const databaseUrl = getDatabaseUrl();

  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg(databaseUrl);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.prisma;
}

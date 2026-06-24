import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_LOCAL_DATABASE_URL } from "../src/lib/db/database-url";
import { seedDemoMap } from "../src/lib/quest/seed-demo-map";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL ?? DEFAULT_LOCAL_DATABASE_URL;
  const adapter = new PrismaPg(connectionString);

  return new PrismaClient({ adapter });
}

async function main() {
  const prisma = createPrismaClient();
  try {
    await seedDemoMap(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectExecution = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectExecution) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}

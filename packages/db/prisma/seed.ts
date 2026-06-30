import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { runSeed } from "../src/seed/admin-user.js";
import { getSeedConfig } from "../src/seed/config.js";

const prismaDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(prismaDirectory, "../../../.env") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

runSeed(prisma, getSeedConfig())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

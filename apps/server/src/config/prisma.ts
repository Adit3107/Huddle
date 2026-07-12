import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: resolve(currentDir, "../../../../.env"),
  quiet: true
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to initialize Prisma.");
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function isLocalDatabase(connectionString: string) {
  const databaseUrl = new URL(connectionString);

  return ["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname);
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDatabase(process.env.DATABASE_URL)
    ? false
    : {
        rejectUnauthorized: false
      }
});

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

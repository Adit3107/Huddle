import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: resolve(currentDir, ".env")
});

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Prisma commands.");
}

export default defineConfig({
  schema: "apps/server/prisma/schema.prisma",
  datasource: {
    url: databaseUrl
  },
  migrations: {
    path: "apps/server/prisma/migrations",
    seed: "tsx apps/server/prisma/seed.ts"
  }
});

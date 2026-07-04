import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: resolve(currentDir, ".env")
});

export default defineConfig({
  schema: "apps/server/prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_URL")
  },
  migrations: {
    path: "apps/server/prisma/migrations",
    seed: "tsx apps/server/prisma/seed.ts"
  }
});

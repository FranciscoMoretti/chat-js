import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

import { databaseConnection } from "./lib/db/connection";

config({
  path: ".env.local",
});

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseConnection(
      {
        DATABASE_URL: process.env.DATABASE_URL,
        DATABASE_MIGRATION_URL: process.env.DATABASE_MIGRATION_URL,
      },
      "migration"
    ).url,
  },
});

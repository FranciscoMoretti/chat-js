import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

import { databaseConnection } from "./lib/db/connection";

config({
  path: ".env.local",
});

export default defineConfig({
  dbCredentials: {
    url: databaseConnection(
      {
        DATABASE_MIGRATION_URL: process.env.DATABASE_MIGRATION_URL,
        DATABASE_URL: process.env.DATABASE_URL,
      },
      "migration"
    ).url,
  },
  dialect: "postgresql",
  out: "./lib/db/migrations",
  schema: "./lib/db/schema.ts",
});

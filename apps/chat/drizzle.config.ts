import { installedDatabaseSchemas } from "./features/installed-database";
import { config } from "dotenv";
import { databaseConnection } from "./lib/db/connection";
import { defineConfig } from "drizzle-kit";

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
  schema: ["./lib/db/schema.ts", ...installedDatabaseSchemas],
});

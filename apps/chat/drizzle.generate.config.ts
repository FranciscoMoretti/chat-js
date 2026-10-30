import { defineConfig } from "drizzle-kit";
import { installedDatabaseSchemas } from "./chatjs/generated/installed-database";

// Generating SQL does not require application secrets or a database connection.
export default defineConfig({
  dialect: "postgresql",
  out: "./lib/db/migrations",
  schema: ["./lib/db/schema.ts", ...installedDatabaseSchemas],
});

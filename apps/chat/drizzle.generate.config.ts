import { defineConfig } from "drizzle-kit";
import { databaseSchemas } from "./integrations/database";

// Generating SQL does not require application secrets or a database connection.
export default defineConfig({
  dialect: "postgresql",
  out: "./lib/db/migrations",
  schema: ["./lib/db/schema.ts", ...databaseSchemas],
});

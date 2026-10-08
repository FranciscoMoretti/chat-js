import { config } from "dotenv";
import { databaseConnection } from "./lib/db/connection";
import { defineConfig } from "drizzle-kit";

config({
  path: ".env.local",
});

/* oxlint-disable import/no-default-export, node/no-process-env --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 * node/no-process-env (#537): default export reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
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
/* oxlint-enable import/no-default-export, node/no-process-env */

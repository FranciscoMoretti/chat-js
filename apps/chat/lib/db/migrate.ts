import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { databaseConnection } from "./connection";

config({
  path: ".env.local",
});

const runMigrate = async () => {
  // Deployment builds preserve the Vercel preview safeguard. Explicit db:migrate
  // runs on every host and never relies on a deployment vendor's environment.
  if (
    process.argv.includes("--deployment") &&
    process.env.VERCEL_ENV !== "production"
  ) {
    console.log(
      "Skipping automatic migrations outside a production Vercel deployment"
    );
    return;
  }

  const settings = databaseConnection(
    {
      DATABASE_MIGRATION_URL: process.env.DATABASE_MIGRATION_URL,
      DATABASE_URL: process.env.DATABASE_URL,
    },
    "migration"
  );
  const connection = postgres(settings.url, settings.options);
  const db = drizzle(connection);

  console.log("⏳ Running migrations...");

  const start = Date.now();
  try {
    await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  } finally {
    await connection.end();
  }
  const end = Date.now();

  console.log("✅ Migrations completed in", end - start, "ms");
};

try {
  await runMigrate();
} catch (error) {
  console.error("❌ Migration failed");
  console.error(error);
  process.exitCode = 1;
}

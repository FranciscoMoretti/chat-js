import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "@/lib/env";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { databaseConnection } from "./connection";
/* oxlint-enable sort-imports */

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle
const connection = databaseConnection(env);
const client = postgres(connection.url, connection.options);
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (db); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const db = drizzle(client);
/* oxlint-enable import/prefer-default-export, import/no-named-export */

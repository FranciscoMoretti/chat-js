/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import { databaseConnection } from "./connection";
/* oxlint-enable sort-imports */

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle
const connection = databaseConnection(env);
const client = postgres(connection.url, connection.options);
/* oxlint-disable import/no-named-export, import/prefer-default-export --
 * import/no-named-export (#527): Preserve the named db API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): db remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 */
export const db = drizzle(client);
/* oxlint-enable import/no-named-export, import/prefer-default-export */

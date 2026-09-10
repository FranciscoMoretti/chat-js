import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import { databaseConnection } from "./connection";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle
const connection = databaseConnection(env);
const client = postgres(connection.url, connection.options);
export const db = drizzle(client);

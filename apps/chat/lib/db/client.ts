import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import { databaseConnection } from "./connection";

const createDatabase = () => {
  const connection = databaseConnection(env);
  return drizzle(postgres(connection.url, connection.options));
};

// Next discovers application route modules during guest-only builds. They may
// import this handle, but using any database feature in that mode fails closed.
export const db = env.CHATJS_GUEST_ONLY
  ? new Proxy(drizzle.mock(), {
      get: () => {
        throw new Error(
          "Application database features are unavailable in guest-only mode."
        );
      },
    })
  : createDatabase();

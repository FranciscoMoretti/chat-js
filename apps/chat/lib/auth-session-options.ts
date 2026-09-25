import { createHash } from "node:crypto";

/** Localhost cookies span ports. Isolate local app/database pairs, and check
 * the database on every development request so resets cannot leave ghost users. */
export const authSessionOptions = ({
  baseUrl,
  databaseUrl,
  development,
}: {
  baseUrl: string;
  databaseUrl: string;
  development: boolean;
}) => {
  let cookiePrefix = "better-auth";
  if (development) {
    const database = new URL(databaseUrl);
    database.password = "";
    const scope = createHash("sha256")
      .update(new URL(baseUrl).origin)
      .update("\0")
      .update(database.toString())
      .digest("hex")
      .slice(0, 16);
    cookiePrefix = `chatjs-dev-${scope}`;
  }
  return {
    advanced: { cookiePrefix },
    session: {
      cookieCache: { enabled: !development, maxAge: 60 * 5 },
    },
  };
};

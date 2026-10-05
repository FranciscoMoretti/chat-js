import { eq } from "drizzle-orm";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { auth } from "@/lib/auth";
/* oxlint-enable sort-imports */
import { db } from "@/lib/db/client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { session, user } from "@/lib/db/schema";
/* oxlint-enable sort-imports */
import { env } from "@/lib/env";

/* oxlint-disable max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-params (#511): serializeSignedCookie keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): serializeSignedCookie keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): serializeSignedCookie uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): serializeSignedCookie accepts opt: { path?: string; httpOnly?: boolean; sameSite?: string; secure?: boolean; e; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): serializeSignedCookie intentionally keeps the existing falsy-value behavior of opt.path; opt.httpOnly; opt.secure; opt.sameSite; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const serializeSignedCookie = async (
  name: string,
  value: string,
  secret: string,
  opt: {
    path?: string;
    httpOnly?: boolean;
    sameSite?: string;
    secure?: boolean;
    expires?: Date;
  }
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  const base64Sig = btoa(String.fromCodePoint(...new Uint8Array(signature)));
  const signedValue = encodeURIComponent(`${value}.${base64Sig}`);

  let cookie = `${name}=${signedValue}`;
  if (opt.path) {
    cookie += `; Path=${opt.path}`;
  }
  if (opt.expires) {
    cookie += `; Expires=${opt.expires.toUTCString()}`;
  }
  if (opt.httpOnly) {
    cookie += "; HttpOnly";
  }
  if (opt.secure) {
    cookie += "; Secure";
  }
  if (opt.sameSite) {
    cookie += `; SameSite=${opt.sameSite.charAt(0).toUpperCase() + opt.sameSite.slice(1)}`;
  }
  return cookie;
};
/* oxlint-enable max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, node/no-process-env, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-lines-per-function (#510): GET keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): GET keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): GET uses 30, 24, 60, 1000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * node/no-process-env (#537): GET reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * typescript/strict-boolean-expressions (#610): GET intentionally keeps the existing falsy-value behavior of devUser; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): GET preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const GET = async (): Promise<Response> => {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  const devEmail = "dev@localhost";
  let [devUser] = await db.select().from(user).where(eq(user.email, devEmail));

  if (!devUser) {
    const id = crypto.randomUUID();
    [devUser] = await db
      .insert(user)
      .values({
        email: devEmail,
        emailVerified: true,
        id,
        name: "Dev User",
      })
      .onConflictDoNothing({ target: user.email })
      .returning();
    if (!devUser) {
      [devUser] = await db.select().from(user).where(eq(user.email, devEmail));
    }
  }

  if (!devUser) {
    throw new Error("Failed to create development user");
  }

  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(session).values({
    createdAt: now,
    expiresAt,
    id: crypto.randomUUID(),
    token,
    updatedAt: now,
    userId: devUser.id,
  });

  const { authCookies } = await auth.$context;
  const signedSessionCookie = await serializeSignedCookie(
    authCookies.sessionToken.name,
    token,
    env.AUTH_SECRET,
    {
      expires: expiresAt,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: authCookies.sessionToken.attributes.secure,
    }
  );

  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", signedSessionCookie);

  return new Response(null, {
    headers,
    status: 302,
  });
};
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, node/no-process-env, typescript/strict-boolean-expressions, unicorn/no-null */

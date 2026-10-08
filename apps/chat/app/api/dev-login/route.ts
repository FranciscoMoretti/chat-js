import { eq } from "drizzle-orm";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { auth } from "@/lib/auth";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { session, user } from "@/lib/db/schema";
/* oxlint-enable sort-imports */
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";

const DEV_SESSION_DURATION_MS = 2_592_000_000;
const FIRST_CHARACTER_INDEX = 0;
const AFTER_FIRST_CHARACTER_INDEX = 1;

interface CookieAttributes {
  readonly path?: string;
  readonly httpOnly?: boolean;
  readonly sameSite?: string;
  readonly secure?: boolean;
  readonly expires?: Readonly<Pick<Date, "toUTCString">>;
}

// oxlint-disable-next-line max-statements -- Serialize the five independent native cookie options in their existing getter and output order; compact ternary concatenation conflicts with no-ternary.
const formatSignedCookie = (
  name: string,
  signedValue: string,
  opt: CookieAttributes
): string => {
  let cookie = `${name}=${signedValue}`;
  const hasPath = Boolean(opt.path);
  if (hasPath) {
    cookie += `; Path=${opt.path}`;
  }
  if (opt.expires) {
    cookie += `; Expires=${opt.expires.toUTCString()}`;
  }
  const isHttpOnly = Boolean(opt.httpOnly);
  if (isHttpOnly) {
    cookie += "; HttpOnly";
  }
  const isSecure = Boolean(opt.secure);
  if (isSecure) {
    cookie += "; Secure";
  }
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- Preserve one optional cookie getter read for the guard and TypeScript narrowing for subsequent native string methods; direct Boolean casts conflict with no-extra-boolean-cast.
  if (opt.sameSite) {
    cookie += `; SameSite=${opt.sameSite.charAt(FIRST_CHARACTER_INDEX).toUpperCase() + opt.sameSite.slice(AFTER_FIRST_CHARACTER_INDEX)}`;
  }
  return cookie;
};

/* oxlint-disable oxc/no-async-await -- HMAC import and signing must settle in order, and crypto failures remain rejected promises. */
const serializeSignedCookie = async (
  name: string,
  value: string,
  configuration: {
    readonly secret: string;
    readonly settings: CookieAttributes;
  }
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(configuration.secret),
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

  return formatSignedCookie(name, signedValue, configuration.settings);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Framework discovery uses these named bindings (GET); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve GET's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-lines-per-function, max-statements, node/no-process-env, unicorn/no-null -- * max-lines-per-function, max-statements: preserve the inline database read/create/reselect and session creation. An async lookup helper introduces a continuation before token/clock reads; the synchronous formatter has been extracted.
 * node/no-process-env (#537): GET reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * unicorn/no-null (#570): GET preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
export const GET = async (): Promise<Response> => {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  const devEmail = "dev@localhost";
  let [devUser] = await db.select().from(user).where(eq(user.email, devEmail));

  const userExists = Boolean(devUser);
  if (!userExists) {
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
    const createdUserExists = Boolean(devUser);
    if (!createdUserExists) {
      [devUser] = await db.select().from(user).where(eq(user.email, devEmail));
    }
  }

  const sessionUserExists = Boolean(devUser);
  if (!sessionUserExists) {
    throw new Error("Failed to create development user");
  }

  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(Date.now() + DEV_SESSION_DURATION_MS);

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
    {
      secret: env.AUTH_SECRET,
      settings: {
        expires: expiresAt,
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: authCookies.sessionToken.attributes.secure,
      },
    }
  );

  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", signedSessionCookie);

  return new Response(null, {
    headers,
    status: 302,
  });
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, node/no-process-env, unicorn/no-null */

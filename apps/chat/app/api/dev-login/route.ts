import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { session, user } from "@/lib/db/schema";
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
  const { sameSite } = opt;
  if (typeof sameSite === "string" && sameSite.length > 0) {
    cookie += `; SameSite=${sameSite.charAt(FIRST_CHARACTER_INDEX).toUpperCase() + sameSite.slice(AFTER_FIRST_CHARACTER_INDEX)}`;
  }
  return cookie;
};

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

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { session, user } from "@/lib/db/schema";
import { env } from "@/lib/env";

async function serializeSignedCookie(
  name: string,
  value: string,
  secret: string,
  opt: {
    path?: string;
    httpOnly?: boolean;
    sameSite?: string;
    expires?: Date;
  }
): Promise<string> {
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
  const base64Sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
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
  if (opt.sameSite) {
    cookie += `; SameSite=${opt.sameSite.charAt(0).toUpperCase() + opt.sameSite.slice(1)}`;
  }
  return cookie;
}

export async function GET() {
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
      .returning();
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

  const signedSessionCookie = await serializeSignedCookie(
    "better-auth.session_token",
    token,
    env.AUTH_SECRET,
    {
      expires: expiresAt,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    }
  );

  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", signedSessionCookie);

  return new Response(null, {
    headers,
    status: 302,
  });
}

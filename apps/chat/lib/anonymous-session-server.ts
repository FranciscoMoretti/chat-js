"use server";

import { cookies } from "next/headers";

import type { AnonymousSession } from "@/lib/types/anonymous";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";

import { ANONYMOUS_SESSION_COOKIES_KEY } from "./constants";

export async function getAnonymousSession(): Promise<AnonymousSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionData = cookieStore.get(ANONYMOUS_SESSION_COOKIES_KEY);

    if (!sessionData?.value) {
      return null;
    }

    const session = JSON.parse(sessionData.value) as AnonymousSession;

    // Convert createdAt back to Date object if it's a string
    if (typeof session.createdAt === "string") {
      session.createdAt = new Date(session.createdAt);
    }

    // Check if session is expired
    const isExpired =
      Date.now() - session.createdAt.getTime() >
      ANONYMOUS_LIMITS.SESSION_DURATION;

    return isExpired ? null : session;
  } catch (error) {
    console.error("Error parsing anonymous session:", error);
    return null;
  }
}

export async function setAnonymousSession(
  session: AnonymousSession
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ANONYMOUS_SESSION_COOKIES_KEY, JSON.stringify(session), {
    path: "/",
    maxAge: ANONYMOUS_LIMITS.SESSION_DURATION,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

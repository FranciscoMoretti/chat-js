"use client";
import type { AnonymousSession } from "@/lib/types/anonymous";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";

import { ANONYMOUS_SESSION_COOKIES_KEY } from "./constants";

// Client-side cookie helpers
const getCookie = (name: string): string | null => {
  if (typeof document === "undefined") {
    return null;
  }

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(";").shift() || null;
    return cookieValue ? decodeURIComponent(cookieValue) : null;
  }
  return null;
};

const setCookie = (name: string, value: string, maxAge: number): void => {
  if (typeof document === "undefined") {
    return;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const encodedValue = encodeURIComponent(value);
  if ("cookieStore" in window) {
    window.cookieStore
      .set({
        name,
        value: encodedValue,
        path: "/",
        expires: Date.now() + maxAge * 1000,
        sameSite: "lax",
      })
      .catch(() => {
        // Fail silently if Cookie Store API fails
      });
  } else {
    document.cookie = `${name}=${encodedValue}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  }
};

const deleteCookie = (name: string): void => {
  if (typeof document === "undefined") {
    return;
  }
  if ("cookieStore" in window) {
    window.cookieStore.delete(name).catch(() => {
      // Fail silently if Cookie Store API fails
    });
  } else {
    document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
};

export const getAnonymousSession = (): AnonymousSession | null => {
  try {
    const sessionData = getCookie(ANONYMOUS_SESSION_COOKIES_KEY);
    if (!sessionData) {
      return null;
    }

    const session = JSON.parse(sessionData) as AnonymousSession;

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
};

export const setAnonymousSession = (session: AnonymousSession): void => {
  setCookie(
    ANONYMOUS_SESSION_COOKIES_KEY,
    JSON.stringify(session),
    ANONYMOUS_LIMITS.SESSION_DURATION
  );
};

export const clearAnonymousSession = (): void => {
  deleteCookie(ANONYMOUS_SESSION_COOKIES_KEY);
};

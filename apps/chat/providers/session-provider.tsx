"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@/lib/auth";
import authClient from "@/lib/auth-client";

interface SessionContextValue {
  data: Session | null;
  /**
   * True while the shell has neither a streamed server session nor a settled
   * client session. Consumers should treat this as "unknown", not anonymous.
   */
  isPending: boolean;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined
);

const SessionSeedContext = createContext<
  ((session: Session | null) => void) | null
>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const {
    data: clientSession,
    isPending: isClientPending,
    error: clientError,
  } = authClient.useSession();
  // undefined = not seeded from the server tree yet
  const [serverSession, setServerSession] = useState<
    Session | null | undefined
  >(undefined);
  const isSeeded = serverSession !== undefined;

  const value = useMemo<SessionContextValue>(() => {
    const seededSession = isSeeded ? serverSession : null;

    // Unknown until the server tree seeds us or the client session settles.
    if (!isSeeded && isClientPending) {
      return {
        data: clientSession ?? null,
        isPending: true,
      };
    }

    // Settled client null is authoritative (sign-out). Only keep the server
    // seed while the client fetch is still pending or failed (e.g. blocked
    // get-session / trustedOrigins mismatch).
    const effective =
      isClientPending || clientError != null
        ? (clientSession ?? seededSession)
        : clientSession;

    return {
      data: effective ?? null,
      // Once seeded, never treat a hung client fetch as anonymous/pending.
      isPending: false,
    };
  }, [clientError, clientSession, isClientPending, isSeeded, serverSession]);

  return (
    <SessionSeedContext.Provider value={setServerSession}>
      <SessionContext.Provider value={value}>
        {children}
      </SessionContext.Provider>
    </SessionSeedContext.Provider>
  );
}

export function SessionSeed({ session }: { session: Session | null }) {
  const setServerSession = useContext(SessionSeedContext);

  if (!setServerSession) {
    throw new Error("SessionSeed must be used within a SessionProvider");
  }

  useLayoutEffect(() => {
    setServerSession(session);
  }, [session, setServerSession]);

  return null;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}

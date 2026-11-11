"use client";

import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import type { Session } from "@/lib/auth";
import authClient from "@/lib/auth-client";

import { SessionContext } from "./session-context";
import type { SessionContextValue } from "./session-context";

const SessionSeedContext = createContext<
  ((session: ReadonlyNativeSurface<Session | null>) => void) | null
>(null);

const SessionProvider = ({
  children,
}: {
  readonly children: ReadonlyReactNode;
}): React.JSX.Element => {
  const {
    data: clientSession,
    isPending: isClientPending,
    error: clientError,
  } = authClient.useSession();
  // `undefined` means the server tree has not seeded the session yet.
  const [serverSession, setServerSession] = useState<
    Session | null | undefined
  >();
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
      isClientPending || (clientError !== null && clientError !== undefined)
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
};

const SessionSeed = ({
  session,
}: ReadonlyNativeSurface<{ readonly session: Session | null }>): null => {
  const setServerSession = useContext(SessionSeedContext);

  if (!setServerSession) {
    throw new Error("SessionSeed must be used within a SessionProvider");
  }

  useLayoutEffect(() => {
    setServerSession(session);
  }, [session, setServerSession]);

  return null;
};

export { SessionProvider, SessionSeed };
export { useSession } from "./session-context";

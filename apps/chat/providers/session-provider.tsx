"use client";

import React, {
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

/* oxlint-disable no-undefined --
 * no-undefined (#519): SessionContext uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
const SessionContext = createContext<SessionContextValue | undefined>(
  undefined
);
/* oxlint-enable no-undefined */

/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * typescript/prefer-readonly-parameter-types (#565): SessionSeedContext accepts session: Session | null; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): SessionSeedContext preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const SessionSeedContext = createContext<
  ((session: Session | null) => void) | null
>(null);
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null -- no-undefined (#519): SessionProvider uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/prefer-readonly-parameter-types (#565): SessionProvider accepts { children, }: { children: React.ReactNode; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): SessionProvider preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
const SessionProvider = ({
  children,
}: {
  children: React.ReactNode;
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
/* oxlint-enable no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- react/no-multi-comp (#552): SessionSeed keeps related render components together; extraction changes component, state, and layout boundaries.
typescript/explicit-function-return-type (#560): Keep SessionSeed's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep SessionSeed's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): SessionSeed accepts { session }: { session: Session | null }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): SessionSeed preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
const SessionSeed = ({ session }: { session: Session | null }) => {
  const setServerSession = useContext(SessionSeedContext);

  if (!setServerSession) {
    throw new Error("SessionSeed must be used within a SessionProvider");
  }

  useLayoutEffect(() => {
    setServerSession(session);
  }, [session, setServerSession]);

  return null;
};
/* oxlint-enable react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */

const useSession = (): SessionContextValue => {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
};

/* oxlint-disable react/only-export-components -- #620: Consumers import SessionProvider, SessionSeed, useSession from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { SessionProvider, SessionSeed, useSession };
/* oxlint-enable react/only-export-components */

"use client";
import { createContext, useContext } from "react";
import type { Session } from "../lib/auth";

export interface SessionContextValue {
  data: Session | null;
  /**
   * True while the shell has neither a streamed server session nor a settled
   * client session. Consumers should treat this as "unknown", not anonymous.
   */
  isPending: boolean;
}

export const SessionContext = createContext<SessionContextValue | undefined>(
  undefined
);

export const useSession = (): SessionContextValue => {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
};

interface SessionIdentity {
  readonly auth: {
    readonly initiator: {
      readonly authenticator?: string;
      readonly attributes?: Readonly<
        Record<string, string | readonly string[]>
      >;
    } | null;
  };
}

/** Only channel-verified, persisted initiator identity selects the session class. */
export const isGuestSession = (session: SessionIdentity): boolean =>
  session.auth.initiator?.authenticator === "chatjs-disposable-guest";

/** A guest cannot acquire account capabilities through reconnect or current auth. */
export const requireAccountSession = (session: SessionIdentity): void => {
  if (!session.auth.initiator || isGuestSession(session)) {
    throw new Error("This operation requires an account session.");
  }
};

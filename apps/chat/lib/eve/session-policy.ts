/** Server-owned guest policy. Public constants describe limits, never authorize them. */
export const GUEST_POLICY = {
  version: "1",
  modelId: "openai/gpt-5-nano",
  messageLimit: 10,
  requestsPerMinute: 5,
  sessionsPerHour: 5,
  credentialDurationMs: 3_600_000,
  retentionMs: 86_400_000,
  maxMessageCharacters: 4000,
  maxInputCharacters: 24_000,
  maxOutputTokens: 512,
} as const;

export const GUEST_INSTRUCTIONS =
  "You are a helpful assistant. This is a temporary text conversation. You have no tools, files, saved user history, or ability to perform external actions.";

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
  if (isGuestSession(session)) {
    throw new Error("This operation requires an account session.");
  }
};

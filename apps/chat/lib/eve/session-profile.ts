import { sessionProfiles } from "@/integrations/chat/session-profiles";
import type { SessionProfile } from "@/chatjs/core/session/contracts";

/** Optional application policy for a persisted initiator. Native EVE callers need no registration. */
export const findSessionProfile = (session: {
  readonly auth: {
    readonly initiator: { readonly authenticator?: string } | null;
  };
}): SessionProfile | undefined => {
  const profiles = sessionProfiles.filter(
    (candidate) =>
      candidate.authenticator === session.auth.initiator?.authenticator
  );
  if (profiles.length > 1) {
    throw new Error("Multiple session profiles use the same authenticator.");
  }
  const profile = profiles.at(0);
  if (
    !profile &&
    session.auth.initiator?.authenticator?.startsWith("chatjs-") === true
  ) {
    throw new Error("This session profile is not installed.");
  }
  return profile;
};

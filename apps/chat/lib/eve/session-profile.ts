import { sessionProfiles } from "@/integrations/session-profiles";
import type { SessionProfile } from "@/lib/session-profile-contracts";

/** Resolve only persisted initiator identity; unknown or removed profiles fail closed. */
export const requireSessionProfile = (session: {
  readonly auth: {
    readonly initiator: { readonly authenticator?: string } | null;
  };
}): SessionProfile => {
  const profiles = sessionProfiles.filter(
    (candidate) =>
      candidate.authenticator === session.auth.initiator?.authenticator
  );
  if (profiles.length > 1) {
    throw new Error("Multiple session profiles use the same authenticator.");
  }
  const profile = profiles.at(0);
  if (!profile) {
    throw new Error("This session profile is not installed.");
  }
  return profile;
};

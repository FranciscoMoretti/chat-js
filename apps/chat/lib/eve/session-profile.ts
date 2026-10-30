import { installedSessionProfiles } from "@/chatjs/generated/installed-session-profiles";
import type { SessionProfile } from "@/lib/session-profile-contracts";

/** Resolve only persisted initiator identity; unknown or removed profiles fail closed. */
export const requireSessionProfile = (session: {
  readonly auth: {
    readonly initiator: { readonly authenticator?: string } | null;
  };
}): SessionProfile => {
  const profile = installedSessionProfiles.find(
    (candidate) =>
      candidate.authenticator === session.auth.initiator?.authenticator
  );
  if (!profile) {
    throw new Error("This session profile is not installed.");
  }
  return profile;
};

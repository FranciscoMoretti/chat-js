import type { SessionProfile } from "@/chatjs/core/session/contracts";
import { authenticateDisposableGuest } from "./guest-auth";
import { resolveGuestModel } from "./guest-model";
import { GUEST_INSTRUCTIONS } from "./guest-policy";

export const guestSessionProfile = {
  authenticator: "chatjs-disposable-guest",
  authenticate: authenticateDisposableGuest,
  resolveModel: resolveGuestModel,
  instructions: GUEST_INSTRUCTIONS,
} satisfies SessionProfile;

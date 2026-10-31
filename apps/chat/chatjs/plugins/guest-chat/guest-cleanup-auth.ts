import { getEveConnectionOptions } from "@/lib/eve/connection-options";
import { issueGuestCredential } from "@/chatjs/plugins/guest-chat/guest-credential";

/** Server-only cleanup authorization is valid only for a deletion-pending policy. */
export const getGuestCleanupConnectionOptions = (input: {
  readonly policyId: string;
  readonly modelId: string;
  readonly ownerId: string;
  readonly sessionId?: string;
}): ReturnType<typeof getEveConnectionOptions> => ({
  ...getEveConnectionOptions(input.ownerId),
  auth: {
    bearer: issueGuestCredential({
      ...input,
      expiresAt: Date.now() + 300_000,
      purpose: "cleanup",
    }),
  },
});

import type { SessionProfile } from "@/chatjs/core/session/contracts";

// Only ChatJS-managed documents need an application resource binding.
export const slackSessionProfile = {
  authenticator: "slack-webhook",
  documents: async (context) => {
    const { slackDocuments } = await import("./slack-documents");
    return await slackDocuments(context);
  },
} satisfies SessionProfile;

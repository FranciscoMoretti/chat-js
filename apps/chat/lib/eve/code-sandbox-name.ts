import { createHash } from "node:crypto";

/** Stable provider identity without exposing account IDs in resource names. */
export const eveCodeSandboxName = ({
  ownerId,
  sessionId,
  callId,
  provider,
}: {
  ownerId: string | undefined;
  sessionId: string | undefined;
  callId: string;
  provider: {
    teamId: string;
    projectId: string;
  };
}) => {
  if (
    !(
      ownerId?.trim() &&
      sessionId?.trim() &&
      callId.trim() &&
      provider.teamId.trim() &&
      provider.projectId.trim()
    )
  ) {
    throw new Error(
      "Code execution requires an authenticated native tool call."
    );
  }
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        "chatjs-code-v2",
        provider.teamId,
        provider.projectId,
        ownerId,
        sessionId,
        callId,
      ])
    )
    .digest("hex");
  return `chatjs-code-${digest.slice(0, 48)}`;
};

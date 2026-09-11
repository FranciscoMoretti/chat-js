import { createHash } from "node:crypto";

/** Stable provider identity without exposing account IDs in resource names. */
export function eveCodeSandboxName({
  ownerId,
  sessionId,
  callId,
}: {
  ownerId: string | undefined;
  sessionId: string | undefined;
  callId: string;
}) {
  if (!(ownerId?.trim() && sessionId?.trim() && callId.trim())) {
    throw new Error(
      "Code execution requires an authenticated native tool call."
    );
  }
  const digest = createHash("sha256")
    .update(JSON.stringify(["chatjs-code-v1", ownerId, sessionId, callId]))
    .digest("hex");
  return `chatjs-code-${digest.slice(0, 48)}`;
}

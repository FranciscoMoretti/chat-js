import type { SandboxScope } from "@chat-js/sandboxes/provider";
import { createHash } from "node:crypto";

const DIGEST_PREFIX_START = 0;
const SANDBOX_DIGEST_LENGTH = 48;

/**
 * Stable provider identity without exposing account IDs in resource names.
 * @param {{ readonly ownerId: string | undefined; readonly sessionId: string | undefined; readonly callId: string; readonly provider: SandboxScope; }} options Native tool call and provider identity used to isolate a code-execution sandbox.
 * @param {string | undefined} options.ownerId Authenticated account identity; absent or blank values are rejected.
 * @param {string | undefined} options.sessionId Native session identity; absent or blank values are rejected.
 * @param {string} options.callId Native tool-call identity for this execution.
 * @param {SandboxScope} options.provider Provider deployment coordinates included in the sandbox digest.
 * @param {string} options.provider.providerId Sandbox provider discriminator; blank values are rejected.
 * @param {string} options.provider.accountId Provider account identity; blank values are rejected.
 * @param {string} options.provider.scopeId Provider deployment identity; blank values are rejected.
 * @returns {string} A stable sandbox name with a truncated SHA-256 digest of the original identity values.
 */
export const eveCodeSandboxName = ({
  ownerId,
  sessionId,
  callId,
  provider,
}: {
  readonly ownerId: string | undefined;
  readonly sessionId: string | undefined;
  readonly callId: string;
  readonly provider: SandboxScope;
}): string => {
  if (
    (ownerId ?? "").trim() === "" ||
    (sessionId ?? "").trim() === "" ||
    callId.trim() === "" ||
    provider.providerId.trim() === "" ||
    provider.accountId.trim() === "" ||
    provider.scopeId.trim() === ""
  ) {
    throw new Error(
      "Code execution requires an authenticated native tool call."
    );
  }
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        "chatjs-code",
        provider.providerId,
        provider.accountId,
        provider.scopeId,
        ownerId,
        sessionId,
        callId,
      ])
    )
    .digest("hex");
  return `chatjs-code-${digest.slice(DIGEST_PREFIX_START, SANDBOX_DIGEST_LENGTH)}`;
};

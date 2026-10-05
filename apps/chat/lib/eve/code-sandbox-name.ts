/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";
/* oxlint-enable import/no-nodejs-modules */

const DIGEST_PREFIX_START = 0;
const SANDBOX_DIGEST_LENGTH = 48;

/**
 * Stable provider identity without exposing account IDs in resource names.
 * @param {{ readonly ownerId: string | undefined; readonly sessionId: string | undefined; readonly callId: string; readonly provider: { readonly teamId: string; readonly projectId: string; }; }} options Native tool call and provider identity used to isolate a code-execution sandbox.
 * @param {string | undefined} options.ownerId Authenticated account identity; absent or blank values are rejected.
 * @param {string | undefined} options.sessionId Native session identity; absent or blank values are rejected.
 * @param {string} options.callId Native tool-call identity for this execution.
 * @param {{ readonly teamId: string; readonly projectId: string; }} options.provider Provider deployment coordinates included in the sandbox digest.
 * @param {string} options.provider.teamId Provider team identity; blank values are rejected.
 * @param {string} options.provider.projectId Provider project identity; blank values are rejected.
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
  readonly provider: {
    readonly teamId: string;
    readonly projectId: string;
  };
}): string => {
  if (
    (ownerId?.trim() ?? "") === "" ||
    (sessionId?.trim() ?? "") === "" ||
    callId.trim() === "" ||
    provider.teamId.trim() === "" ||
    provider.projectId.trim() === ""
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
  return `chatjs-code-${digest.slice(DIGEST_PREFIX_START, SANDBOX_DIGEST_LENGTH)}`;
};

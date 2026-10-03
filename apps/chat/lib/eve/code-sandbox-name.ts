/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): eveCodeSandboxName's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): eveCodeSandboxName's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): eveCodeSandboxName uses 0, 48 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): eveCodeSandboxName accepts { ownerId, sessionId, callId, provider, }: { ownerId: string | undefined; sessionId: ; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): eveCodeSandboxName intentionally keeps the existing falsy-value behavior of ownerId?.trim(); sessionId?.trim(); distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
}): string => {
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

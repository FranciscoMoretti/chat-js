/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/no-named-export (#527): Preserve the named eveCodeSandboxName API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): eveCodeSandboxName remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): eveCodeSandboxName's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): eveCodeSandboxName's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): eveCodeSandboxName uses 0, 48 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-optional-chaining (#542): eveCodeSandboxName handles optional ownerId?.trim(); sessionId?.trim() without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

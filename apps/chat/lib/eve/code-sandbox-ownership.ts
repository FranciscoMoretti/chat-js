/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-code-sandboxes" dependency within this package instead of introducing an alias or barrel API.
 */
import {
  confirmEveCodeSandboxCreation,
  recordEveCodeSandboxDeletion,
  reserveEveCodeSandbox,
} from "../db/eve-code-sandboxes";
import { resolveEveConversationScope } from "./conversation-scope";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export, init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/no-named-export (#527): Preserve the named eveCodeSandboxOwnership API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): eveCodeSandboxOwnership remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * init-declarations (#507): eveCodeSandboxOwnership assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * jsdoc/require-param (#534): eveCodeSandboxOwnership's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): eveCodeSandboxOwnership's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): eveCodeSandboxOwnership keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): eveCodeSandboxOwnership sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): eveCodeSandboxOwnership handles optional context.session.auth.initiator?.principalId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): eveCodeSandboxOwnership copies or separates ...scope while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep eveCodeSandboxOwnership's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep eveCodeSandboxOwnership's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): eveCodeSandboxOwnership accepts context: { callId: string; session?: { id: string; auth: { initiator?: { p; provider: { teamId: string; projectId: string; }; signal?: AbortSignal; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** One native tool invocation owns one allocation intent, including failed creates. */
export const eveCodeSandboxOwnership = (context: {
  callId: string;
  session?: {
    id: string;
    auth: {
      initiator?: {
        principalId: string;
      } | null;
    };
  };
}) => {
  let reservation:
    | {
        ownerId: string;
        conversationId: string;
        name: string;
      }
    | undefined;
  return {
    async created(name: string): Promise<void> {
      if (!reservation || reservation.name !== name) {
        throw new Error(
          "Code sandbox identity does not match its allocation intent."
        );
      }
      await confirmEveCodeSandboxCreation(
        reservation.ownerId,
        reservation.conversationId,
        name
      );
    },
    async release(): Promise<void> {
      if (!reservation) {
        throw new Error("Code sandbox allocation intent is missing.");
      }
      await recordEveCodeSandboxDeletion(
        reservation.ownerId,
        reservation.conversationId,
        reservation.name
      );
    },
    async reserve(
      provider: {
        teamId: string;
        projectId: string;
      },
      signal?: AbortSignal
    ): Promise<string> {
      if (!context.session) {
        throw new Error("Code execution requires a native session.");
      }
      const scope = await resolveEveConversationScope(
        context.session.auth.initiator?.principalId,
        context.session.id,
        signal ?? new AbortController().signal
      );
      const name = await reserveEveCodeSandbox(
        scope.ownerId,
        scope.conversationId,
        context.callId,
        provider
      );
      reservation = { ...scope, name };
      return name;
    },
  };
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

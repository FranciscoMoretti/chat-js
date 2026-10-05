import {
  confirmEveCodeSandboxCreation,
  recordEveCodeSandboxDeletion,
  reserveEveCodeSandbox,
} from "@/lib/db/eve-code-sandboxes";

import { resolveEveConversationScope } from "./conversation-scope";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (eveCodeSandboxOwnership); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * init-declarations (#507): eveCodeSandboxOwnership assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * jsdoc/require-param (#534): eveCodeSandboxOwnership's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): eveCodeSandboxOwnership's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): eveCodeSandboxOwnership keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
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
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve created's awaited sequencing and rejected-Promise behavior. */
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
    /* oxlint-enable oxc/no-async-await */
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve release's awaited sequencing and rejected-Promise behavior. */
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
    /* oxlint-enable oxc/no-async-await */
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reserve's awaited sequencing and rejected-Promise behavior. */
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
    /* oxlint-enable oxc/no-async-await */
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

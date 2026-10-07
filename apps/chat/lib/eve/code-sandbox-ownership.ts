import {
  confirmEveCodeSandboxCreation,
  recordEveCodeSandboxDeletion,
  reserveEveCodeSandbox,
} from "@/lib/db/eve-code-sandboxes";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { resolveEveConversationScope } from "./conversation-scope";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (eveCodeSandboxOwnership); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
interface CodeSandboxOwnership {
  created: (name: string) => Promise<void>;
  release: () => Promise<void>;
  reserve: (
    provider: { readonly teamId: string; readonly projectId: string },
    signal?: ReadonlyNativeSurface<AbortSignal>
  ) => Promise<string>;
}

/**
 * Track the allocation intent owned by one native tool invocation, including failed creates.
 * @param {{ readonly callId: string; readonly session?: { readonly id: string; readonly auth: { readonly initiator?: { readonly principalId: string } | null } } }} context - Tool call and native session identity used to authorize and reserve its sandbox.
 * @returns {CodeSandboxOwnership} Callbacks that reserve, confirm and release the same durable allocation intent.
 */
// oxlint-disable-next-line max-lines-per-function -- The three allocation callbacks currently close over one reservation and invocation context; further decomposition of this shared-state boundary remains under review.
export const eveCodeSandboxOwnership = (context: {
  readonly callId: string;
  readonly session?: {
    readonly id: string;
    readonly auth: {
      readonly initiator?: {
        readonly principalId: string;
      } | null;
    };
  };
}): CodeSandboxOwnership => {
  // oxlint-disable-next-line init-declarations -- No allocation exists until reserve succeeds; explicit undefined initialization conflicts with no-undefined.
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
      provider: { readonly teamId: string; readonly projectId: string },
      signal?: ReadonlyNativeSurface<AbortSignal>
    ): Promise<string> {
      if (!context.session) {
        throw new Error("Code execution requires a native session.");
      }
      const scope = await resolveEveConversationScope(
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing scope own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      reservation = { ...scope, name };
      return name;
    },
    /* oxlint-enable oxc/no-async-await */
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */

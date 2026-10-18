import type { SandboxScope } from "@chat-js/sandboxes/provider";
import {
  confirmEveCodeSandboxCreation,
  recordEveCodeSandboxDeletion,
  reserveEveCodeSandbox,
} from "@/lib/db/eve-code-sandboxes";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { resolveEveConversationScope } from "./conversation-scope";

interface CodeSandboxOwnership {
  created: (name: string) => Promise<void>;
  release: () => Promise<void>;
  reserve: (
    provider: SandboxScope,
    signal?: ReadonlyNativeSurface<AbortSignal>
  ) => Promise<string>;
}

/**
 * Track the allocation intent owned by one native tool invocation, including failed creates.
 * @param {{ readonly callId: string; readonly session?: { readonly id: string; readonly auth: { readonly initiator?: { readonly principalId: string } | null } } }} context - Tool call and native session identity used to authorize and reserve its sandbox.
 * @returns {CodeSandboxOwnership} Callbacks that reserve, confirm and release the same durable allocation intent.
 */
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
      provider: SandboxScope,
      signal?: ReadonlyNativeSurface<AbortSignal>
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

import {
  confirmEveCodeSandboxCreation,
  recordEveCodeSandboxDeletion,
  reserveEveCodeSandbox,
} from "../db/eve-code-sandboxes";
import { resolveEveConversationScope } from "./conversation-scope";

/** One native tool invocation owns one allocation intent, including failed creates. */
export function eveCodeSandboxOwnership(context: {
  callId: string;
  session?: {
    id: string;
    auth: { initiator?: { principalId: string } | null };
  };
}) {
  let reservation:
    | { ownerId: string; conversationId: string; name: string }
    | undefined;
  return {
    async reserve(signal?: AbortSignal) {
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
        context.callId
      );
      reservation = { ...scope, name };
      return name;
    },
    async created(name: string) {
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
    async release() {
      if (!reservation) {
        throw new Error("Code sandbox allocation intent is missing.");
      }
      await recordEveCodeSandboxDeletion(
        reservation.ownerId,
        reservation.conversationId,
        reservation.name
      );
    },
  };
}

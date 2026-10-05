import { after } from "next/server";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "@/lib/env";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  conversationBinding,
  createConversationInput,
} from "@/lib/eve/contracts";
/* oxlint-enable sort-imports */
import { persistGeneratedEveConversationTitle } from "@/lib/eve/conversation-title";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createEveConversationOperation } from "@/lib/eve/create-conversation-operation";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  admitGuestCreation,
  settleGuestCreation,
} from "@/lib/eve/guest-admission";
/* oxlint-enable sort-imports */
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Framework discovery uses these named bindings (POST); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve POST's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null --
 * max-lines-per-function (#510): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): POST uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): POST accepts request: Request; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): POST preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/no-null (#570): POST preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const POST = async (request: Request): Promise<Response> => {
  const principal = await resolveEvePrincipal(request.headers);
  if (!principal) {
    return new Response(null, { status: 401 });
  }
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return new Response(null, { status: 403 });
  }
  const input = createConversationInput.safeParse(
    await request.json().catch(() => null)
  );
  if (!input.success) {
    return Response.json(
      { error: "Enter a message between 1 and 16,000 characters." },
      { status: 400 }
    );
  }
  const admission =
    principal.kind === "guest"
      ? await admitGuestCreation(request, principal, input.data)
      : undefined;
  if (admission instanceof Response) {
    return admission;
  }
  const response = await createEveConversationOperation(
    principal.ownerId,
    input.data,
    admission?.reservationId
  );
  if (admission) {
    const settled = await settleGuestCreation(
      response,
      principal.ownerId,
      input.data.operationId,
      admission.reservationId
    );
    if (settled === false) {
      const deleted = z
        .object({ code: z.literal("conversation_deleted") })
        .safeParse(
          await response
            .clone()
            .json()
            .catch(() => null)
        );
      if (deleted.success) {
        return response;
      }
      return Response.json(
        {
          error:
            "Creation is unresolved. Retry the saved operation to recover it.",
        },
        { status: 503 }
      );
    }
  }
  if (response.ok && !input.data.fork) {
    const binding = conversationBinding.safeParse(
      await response
        .clone()
        .json()
        .catch(() => null)
    );
    if (binding.success) {
      after(() =>
        persistGeneratedEveConversationTitle({
          conversationId: binding.data.id,
          message: input.data.message,
          ownerId: principal.ownerId,
        })
      );
    }
  }
  return response;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null */

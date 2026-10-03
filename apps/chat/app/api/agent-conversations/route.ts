import { after } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import {
  conversationBinding,
  createConversationInput,
} from "@/lib/eve/contracts";
import { persistGeneratedEveConversationTitle } from "@/lib/eve/conversation-title";
import { createEveConversationOperation } from "@/lib/eve/create-conversation-operation";
import {
  admitGuestCreation,
  settleGuestCreation,
} from "@/lib/eve/guest-admission";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";

/* oxlint-disable max-lines-per-function, max-statements, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null  --
 * import/no-named-export (#527): Preserve the named POST API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): POST remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * max-lines-per-function (#510): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-ternary (#518): POST derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): POST uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): POST sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): POST handles optional admission?.reservationId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
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
/* oxlint-enable max-lines-per-function, max-statements, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null */

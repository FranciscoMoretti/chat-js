import { after } from "next/server";

import { env } from "@/lib/env";
import { persistGeneratedEveConversationTitle } from "@/lib/eve/conversation-title";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { admitGuestResponseGroup } from "@/lib/eve/guest-group-admission";
/* oxlint-enable sort-imports */
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createEveResponseGroup } from "@/lib/eve/response-group";
/* oxlint-enable sort-imports */
import { eveResponseGroupResult } from "@/lib/eve/response-group-contracts";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveResponseGroupInput } from "@/lib/eve/response-group-input";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Framework discovery uses these named bindings (POST); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve POST's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

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
  const input = eveResponseGroupInput.safeParse(
    await request.json().catch(() => null)
  );
  if (!input.success) {
    return Response.json(
      { error: "Invalid response group request." },
      { status: 400 }
    );
  }
  try {
    const admission =
      principal.kind === "guest"
        ? await admitGuestResponseGroup(request, principal, input.data)
        : undefined;
    if (admission instanceof Response) {
      return admission;
    }
    const result = eveResponseGroupResult.parse(
      await createEveResponseGroup(principal.ownerId, input.data, admission)
    );
    // Initial comparison candidates share a logical chat. Title it once from
    // the bound primary candidate, after the response has been sent.
    if (!input.data.fork) {
      const source = result.candidates.find(
        (candidate) => candidate.state === "bound"
      );
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading state from source; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      if (source?.state === "bound") {
        after(() =>
          persistGeneratedEveConversationTitle({
            conversationId: source.conversationId,
            message: input.data.message,
            ownerId: principal.ownerId,
          })
        );
      }
    }
    return Response.json(result);
  } catch {
    return Response.json(
      {
        error:
          "Response group is unavailable or unresolved. Retain the original request before retrying.",
      },
      { status: 409 }
    );
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null */

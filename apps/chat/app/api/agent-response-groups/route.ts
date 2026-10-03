import { after } from "next/server";

import { env } from "@/lib/env";
import { persistGeneratedEveConversationTitle } from "@/lib/eve/conversation-title";
import { admitGuestResponseGroup } from "@/lib/eve/guest-group-admission";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";
import { createEveResponseGroup } from "@/lib/eve/response-group";
import { eveResponseGroupResult } from "@/lib/eve/response-group-contracts";
import { eveResponseGroupInput } from "@/lib/eve/response-group-input";

/* oxlint-disable max-lines-per-function, max-statements, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null  --
 * import/no-named-export (#527): Preserve the named POST API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): POST remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * max-lines-per-function (#510): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-ternary (#518): POST derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): POST uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): POST sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): POST handles optional source?.state without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
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
/* oxlint-enable max-lines-per-function, max-statements, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null */

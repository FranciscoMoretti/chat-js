import { auth } from "@/lib/auth";
import { getEveCreation } from "@/lib/db/eve-queries";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "@/lib/env";
/* oxlint-enable sort-imports */
import { eveCopyInput } from "@/lib/eve/copy-input";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveCopyNotReadyError } from "@/lib/eve/copy-transcript";
/* oxlint-enable sort-imports */
import { sameOrigin } from "@/lib/eve/request-policy";
import { saveEveCopyOperation } from "@/lib/eve/save-copy-operation";
// oxlint-disable-next-line sort-imports -- This readonly view preserves the native request/session members and follows the existing runtime import group.
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

const headers = { "cache-control": "no-store" };

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readCopyBody's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements, no-magic-numbers, unicorn/no-null -- max-statements (#512): readCopyBody keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): readCopyBody uses 2048 in its existing protocol/math/layout contract; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): readCopyBody preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */

const readCopyBody = async (
  request: ReadonlyNativeSurface<Pick<Request, "body">>
): Promise<unknown> => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading getReader from request.body; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const reader = request.body?.getReader();
  if (!reader) {
    return null;
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each bounded stream read, readiness attempt, or shared fixture before continuing.
      const result = await reader.read();
      if (result.done) {
        break;
      }
      length += result.value.byteLength;
      if (length > 2048) {
        return null;
      }
      chunks.push(result.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    return null;
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Cancellation can reject after the body stream fails.
    }
    reader.releaseLock();
  }
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Framework discovery uses these named bindings (POST); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve POST's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, unicorn/no-null */

/* oxlint-disable init-declarations, max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions, unicorn/no-null -- init-declarations (#507): POST assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
max-statements (#512): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): POST uses 409, 503 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
no-undefined (#519): POST uses undefined for absent or optional values; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): POST intentionally keeps the existing falsy-value behavior of rejected; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/no-null (#570): POST preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */

// oxlint-disable-next-line max-lines-per-function -- Readonly annotations expand this existing cohesive handler; preserve its authorization, state and awaited operation sequence.
export const POST = async (
  request: ReadonlyNativeSurface<Request>
): Promise<Response> => {
  const session = await auth.api.getSession({ headers: request.headers });
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (!session?.user) {
    return new Response(null, { headers, status: 401 });
  }
  const { origin } = new URL(env.APP_URL ?? request.url);
  if (!sameOrigin(request, origin)) {
    return new Response(null, { headers, status: 403 });
  }
  const input = eveCopyInput.safeParse(await readCopyBody(request));
  if (!input.success) {
    return Response.json(
      { error: "Invalid copy request." },
      { headers, status: 400 }
    );
  }
  try {
    return Response.json(
      await saveEveCopyOperation(session.user.id, input.data, origin),
      { headers }
    );
  } catch (error) {
    let existing;
    try {
      existing = await getEveCreation(session.user.id, input.data.operationId);
    } catch {
      existing = undefined;
    }
    const rejected =
      existing &&
      (existing.creationKind !== "copy" ||
        ["deleting", "deleted"].includes(existing.state));
    let message = "Saving is unconfirmed. Retry to recover the same copy.";
    if (error instanceof EveCopyNotReadyError) {
      ({ message } = error);
    }
    if (rejected) {
      message = "This copy is no longer available.";
    }
    return Response.json(
      {
        conversationId:
          // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when reading creationKind from existing; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep conversationId as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          existing?.creationKind === "copy" ? existing.id : undefined,
        error: message,
        retryable: !rejected,
      },
      // oxlint-disable-next-line no-ternary -- Keep status as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      { headers, status: rejected ? 409 : 503 }
    );
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations, max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions, unicorn/no-null */

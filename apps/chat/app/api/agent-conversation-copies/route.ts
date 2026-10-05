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

const headers = { "cache-control": "no-store" };

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readCopyBody's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * max-statements (#512): readCopyBody keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): readCopyBody uses 2048 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): readCopyBody accepts request: Request; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): readCopyBody preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const readCopyBody = async (request: Request): Promise<unknown> => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve POST's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable init-declarations, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * init-declarations (#507): POST assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-statements (#512): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): POST uses 409, 503 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): POST uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): POST accepts request: Request; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): POST intentionally keeps the existing falsy-value behavior of rejected; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): POST preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const POST = async (request: Request): Promise<Response> => {
  const session = await auth.api.getSession({ headers: request.headers });
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
          existing?.creationKind === "copy" ? existing.id : undefined,
        error: message,
        retryable: !rejected,
      },
      { headers, status: rejected ? 409 : 503 }
    );
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { auth } from "@/lib/auth";
import { getEveCreation } from "@/lib/db/eve-queries";
import { env } from "@/lib/env";
import { eveCopyInput } from "@/lib/eve/copy-input";
import { EveCopyNotReadyError } from "@/lib/eve/copy-transcript";
import { sameOrigin } from "@/lib/eve/request-policy";
import { saveEveCopyOperation } from "@/lib/eve/save-copy-operation";
/* oxlint-enable sort-imports */

const headers = { "cache-control": "no-store" };

/* oxlint-disable max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * max-statements (#512): readCopyBody keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): readCopyBody uses 2048 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): readCopyBody sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): readCopyBody handles optional request.body?.getReader() without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
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
/* oxlint-enable max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable import/no-named-export, import/prefer-default-export, init-declarations, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * import/no-named-export (#527): Preserve the named POST API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): POST remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * init-declarations (#507): POST assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-statements (#512): POST keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): POST uses 409, 503 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): POST derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): POST uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): POST sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): POST handles optional session?.user; existing?.creationKind without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, init-declarations, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

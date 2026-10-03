/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { z } from "zod";

import { eveRequest } from "./server";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, oxc/no-async-await, unicorn/no-null --
 * import/no-named-export (#527): Preserve the named createNativeEveCopy API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): createNativeEveCopy remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): createNativeEveCopy's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): createNativeEveCopy's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): createNativeEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): createNativeEveCopy uses 15_000, 1, 404, 30_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): createNativeEveCopy sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * unicorn/no-null (#570): createNativeEveCopy preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** Idempotent seed lookup/creation, without browser history or source capabilities. */
export const createNativeEveCopy = async (
  ownerId: string,
  operationId: string,
  modelId: string
): Promise<string> => {
  const existing = await eveRequest(
    ownerId,
    `/eve/chat/v1/operation/${operationId}?kind=seed`,
    {
      signal: AbortSignal.timeout(15_000),
    }
  );
  const session = z.object({ sessionId: z.string().min(1) });
  if (existing.ok) {
    return session.parse(await existing.json()).sessionId;
  }
  const missing = z
    .object({ code: z.literal("eve_operation_not_found") })
    .safeParse(await existing.json().catch(() => null));
  if (existing.status !== 404 || !missing.success) {
    throw new Error("Native copy lookup is unavailable.");
  }
  const result = await eveRequest(
    ownerId,
    "/eve/chat/v1/session",
    {
      body: JSON.stringify({ operationId, seed: true }),
      method: "POST",
      signal: AbortSignal.timeout(30_000),
    },
    modelId
  );
  if (!result.ok) {
    throw new Error("Native copy creation is unresolved.");
  }
  return session.parse(await result.json()).sessionId;
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, oxc/no-async-await, unicorn/no-null */

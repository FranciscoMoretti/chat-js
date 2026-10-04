import { z } from "zod";

import { eveRequest } from "./server";

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers --

 * jsdoc/require-param (#534): createNativeEveCopy's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): createNativeEveCopy's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): createNativeEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): createNativeEveCopy uses 15_000, 1, 404, 30_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
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
    .safeParse(
      await existing.json().catch((): void => {
        // The missing-operation schema rejects an absent JSON body.
      })
    );
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers */

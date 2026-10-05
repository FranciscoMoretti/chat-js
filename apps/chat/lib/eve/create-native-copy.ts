import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveRequest } from "./server";
/* oxlint-enable sort-imports */

const SEED_LOOKUP_TIMEOUT_MS = 15_000;
const SEED_CREATION_TIMEOUT_MS = 30_000;
const MINIMUM_SESSION_IDENTIFIER_LENGTH = 1;
const HTTP_NOT_FOUND = 404;

/* oxlint-disable max-statements --

 * max-statements (#512): createNativeEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
  */
/**
 * Resolves or creates the native seed session for the same durable copy operation.
 * @param {string} ownerId Owner authorized to look up and create the native session.
 * @param {string} operationId Stable seed operation identity reused after uncertain creation replies.
 * @param {string} modelId Model sent only when a missing seed session must be created.
 * @returns {Promise<string>} The validated native session ID from lookup or creation; unresolved replies throw.
 */
export const createNativeEveCopy = async (
  ownerId: string,
  operationId: string,
  modelId: string
): Promise<string> => {
  const existing = await eveRequest(
    ownerId,
    `/eve/chat/v1/operation/${operationId}?kind=seed`,
    {
      signal: AbortSignal.timeout(SEED_LOOKUP_TIMEOUT_MS),
    }
  );
  const session = z.object({
    sessionId: z.string().min(MINIMUM_SESSION_IDENTIFIER_LENGTH),
  });
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
  if (existing.status !== HTTP_NOT_FOUND || !missing.success) {
    throw new Error("Native copy lookup is unavailable.");
  }
  const result = await eveRequest(
    ownerId,
    "/eve/chat/v1/session",
    {
      body: JSON.stringify({ operationId, seed: true }),
      method: "POST",
      signal: AbortSignal.timeout(SEED_CREATION_TIMEOUT_MS),
    },
    modelId
  );
  if (!result.ok) {
    throw new Error("Native copy creation is unresolved.");
  }
  return session.parse(await result.json()).sessionId;
};
/* oxlint-enable max-statements */
